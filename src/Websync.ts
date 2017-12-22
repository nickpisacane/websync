import { S3 } from 'aws-sdk'

import { Container, S3PutModifier, S3DeleteModifier, FilterOptions, ItemDiff } from './types'
import S3Container from './S3Container'
import Transfer from './Transfer'
import CloudFrontInvalidator from './CloudFrontIndalidator'
import Stats from './Stats'
import GlobTable from './GlobTable'
import * as Errors from './Errors'
import diff, { DiffKey } from './diff'
import parseContainerFromURL from './parseContainerFromURL'
import generationInvalidations, { WildcardPolicy } from './generateInvalidations'

const isS3Container = (container: Container): container is S3Container =>
  container.type === 'S3'

export interface WebsyncPutModifiers {
  [key: string]: S3PutModifier
}

export interface WebsyncDeleteModifiers {
  [key: string]: S3DeleteModifier
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
}

export default class Websync {
  private source: Container
  private target: Container
  private filterOptions: FilterOptions
  private putOptionsTable: GlobTable<S3PutModifier>
  private deleteOptionsTable: GlobTable<S3DeleteModifier>

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

  constructor(options: WebsyncOptions) {
    this.source = parseContainerFromURL(options.source)
    this.target = parseContainerFromURL(options.target)
    this.filterOptions = { include: options.include, exclude: options.exclude }
    this.putOptionsTable = new GlobTable<S3PutModifier>(options.putOptions || {})
    this.deleteOptionsTable = new GlobTable<S3DeleteModifier>(options.deleteOptions || {})

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
  }

  public async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Errors.AlreadyInitialized()
    }

    this.stats = new Stats()
    this.diffs = await diff(this.source, this.target, this.diffBy, this.filterOptions)
    this.transfer = new Transfer({
      source: this.source,
      target: this.target,
      diffs: this.diffs,
    })

    this.transfer
      .on('putObject', (key: string, options: S3PutModifier) => {
        const opts = this.putOptionsTable.lookup(key)
        if (opts) {
          Object.assign(options, opts)
        }
      })
      .on('deleteObject', (key: string, options: S3DeleteModifier) => {
        const opts = this.deleteOptionsTable.lookup(key)
        if (opts) {
          Object.assign(options, opts)
        }
      })

    this.stats = new Stats({
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
      } catch (err) {
        throw new Errors.InvalidationsFailed(err)
      }
    }

    this.stats.invalidated = invalidate
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