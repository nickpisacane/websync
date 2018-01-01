import { EventEmitter } from 'events'
import { S3, config as AWSConfig } from 'aws-sdk'

import {
  Container,
  S3PutModifier,
  S3DeleteModifier,
  FilterOptions,
  ItemDiff,
  Item,
} from './types'
import S3Container from './S3Container'
import Transfer, { TransferItemCompleteEvent } from './Transfer'
import CloudFrontInvalidator, { CloudFrontInvalidatorOptions } from './CloudFrontIndalidator'
import Stats from './Stats'
import GlobTable from './GlobTable'
import * as Errors from './Errors'
import diff, { DiffKey } from './diff'
import parseContainerFromURL from './parseContainerFromURL'
import generationInvalidations, { WildcardPolicy } from './generateInvalidations'

const isS3Container = (container: Container): container is S3Container =>
  container.type === 'S3'

export type WebsyncModifier <T> = T | ((item: Item) => T)

export interface WebsyncPutModifiers {
  [key: string]: WebsyncModifier<S3PutModifier>
}

export interface WebsyncDeleteModifiers {
  [key: string]: WebsyncModifier<S3DeleteModifier>
}

export interface WebsyncTransferProgressEvent extends TransferItemCompleteEvent {
  progress: number
}

export interface WebsyncEmitter {
  emit(event: 'progress', eventData: WebsyncTransferProgressEvent): boolean
  on(event: 'progress', listener: (eventData: WebsyncTransferProgressEvent) => void): this
}

export interface WebsyncOptions {
  source: string
  target: string
  include?: string
  exclude?: string
  diffBy?: DiffKey
  putOptions?: WebsyncPutModifiers
  deleteOptions?: WebsyncDeleteModifiers
  wildcardPolicy?: WildcardPolicy
  wildcardAll?: boolean
  invalidateDeletes?: boolean
  distributions?: string[]
}

export default class Websync extends EventEmitter implements WebsyncEmitter {
  private source: Container
  private target: Container
  private filterOptions: FilterOptions
  private putOptionsTable: GlobTable<WebsyncModifier<S3PutModifier>>
  private deleteOptionsTable: GlobTable<WebsyncModifier<S3DeleteModifier>>

  private diffBy?: DiffKey = 'size'

  private wildcardPolicy: WildcardPolicy = 'majority'
  private wildcardAll: boolean = false
  private invalidateDeletes: boolean = true

  private initialized: boolean = false
  private completed: boolean = false

  private diffs: ItemDiff[]
  private stats: Stats
  private transfer: Transfer
  private invalidations: string[] | undefined
  private invalidator: CloudFrontInvalidator | undefined
  private distributions: string[]

  private completeCount = 0

  constructor(options: WebsyncOptions) {
    super()

    this.source = parseContainerFromURL(options.source)
    this.target = parseContainerFromURL(options.target)
    this.filterOptions = { include: options.include, exclude: options.exclude }
    this.putOptionsTable = new GlobTable<WebsyncModifier<S3PutModifier>>(options.putOptions || {})
    this.deleteOptionsTable = new GlobTable<WebsyncModifier<S3DeleteModifier>>(options.deleteOptions || {})
    this.completeCount = 0

    if (options.diffBy) {
      this.diffBy = options.diffBy
    }
    if (options.wildcardPolicy) {
      this.wildcardPolicy = options.wildcardPolicy
    }
    if (typeof options.wildcardAll === 'boolean') {
      this.wildcardAll = options.wildcardAll
    }
    if (typeof options.invalidateDeletes === 'boolean') {
      this.invalidateDeletes = options.invalidateDeletes
    }
    if (options.distributions) {
      this.distributions = options.distributions
    }

    this.stats = new Stats({
      source: options.source,
      target: options.target,
    })
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Errors.AlreadyInitialized()
    }

    this.diffs = await diff(this.source, this.target, this.diffBy, this.filterOptions)
    this.transfer = new Transfer({
      source: this.source,
      target: this.target,
      diffs: this.diffs,
    })

    this.transfer
      .on('putObject', (item: Item, options: S3PutModifier) => {
        const opts = this.putOptionsTable.lookup(item.key)
        if (opts) {
          Object.assign(options, typeof opts === 'function' ? opts(item) : opts)
        }
      })
      .on('deleteObject', (item: Item, options: S3DeleteModifier) => {
        const opts = this.deleteOptionsTable.lookup(item.key)
        if (opts) {
          Object.assign(options, typeof opts === 'function' ? opts(item) : opts)
        }
      })
      .on('itemComplete', (data: TransferItemCompleteEvent) => {
        this.completeCount++
        this.emit('progress', Object.assign({
          progress: this.completeCount / this.diffs.length,
        }, data) as WebsyncTransferProgressEvent)
      })

    this.stats.update({
      diffs: this.diffs,
      completed: false,
      constitutesPayment: false,
      invalidated: false,
    })

    if (isS3Container(this.target)) {
      this.invalidations = generationInvalidations({
        diffs: this.diffs,
        targetItems: await this.target.listItems(),
        wildcardPolicy: this.wildcardPolicy,
        wildcardAll: this.wildcardAll,
        invalidateDeletes: this.invalidateDeletes,
      })
      this.invalidator = new CloudFrontInvalidator({
        bucketName: this.target.getBucketName(),
        paths: this.invalidations,
        ids: this.distributions,
      })

      this.stats.update({
        constitutesPayment: await this.invalidator.constitutesPayment(),
        distributions: await this.invalidator.getDistributions(),
        invalidations: this.invalidations,
      })
    }

    this.initialized = true
  }

  public constitutesPayment(): boolean {
    if (!this.initialized) {
      throw new Error(`Websync: Websync must be initialized before calling \`constituesPayment\``)
    }
    return this.stats.constitutesPayment
  }

  public async sync(invalidate: boolean = true): Promise<Stats> {
    const startTime = Date.now()
    this.stats.invalidated = false

    if (this.completed) {
      throw new Errors.AlreadyCompleted()
    }

    try {
      await this.transfer.complete()
    } catch (err) {
      throw new Errors.TransferFailed(err)
    }

    if (this.invalidator && invalidate) {
      try {
        await this.invalidator.invalidate()
        this.stats.invalidated = true
      } catch (err) {
        throw new Errors.InvalidationsFailed(err)
      }
    }

    this.stats.time = Date.now() - startTime
    this.completed = this.stats.completed = true

    return this.stats.clone()
  }

  public getStats(): Stats {
    if (!this.initialized) {
      throw new Error(`Websync: Websync must be initialized before calling \`getStats\``)
    }
    return this.stats.clone()
  }
}