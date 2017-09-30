import { S3 } from 'aws-sdk'
import * as minimatch from 'minimatch'

import { Container, S3PutModifier, S3DeleteModifier, FilterOptions } from './types'
import S3Container from './S3Container'
import Transfer from './Transfer'
import CloudFrontInvalidator from './CloudFrontIndalidator'
import SyncerStats from './SyncerStats'
import GlobTable from './GlobTable'
import * as SyncerErrors from './SyncerErrors'
import diff, { DiffKey } from './diff'
import parseContainerFromURL from './parseContainerFromURL'
import generationInvalidations, { WildcardPolicy } from './generateInvalidations'

export interface SyncerPutOptions {
  [key: string]: S3PutModifier
}

export interface SyncerDeleteOptions {
  [key: string]: S3DeleteModifier
}

export interface SyncerOptions {
  source: string
  target: string
  include?: string
  exclude?: string
  diffBy?: DiffKey
  putOptions?: SyncerPutOptions
  deleteOptions?: SyncerDeleteOptions
}

const isS3Container = (container: Container): container is S3Container =>
  container.type === 'S3'

export default class Syncer {
  private source: Container
  private target: Container
  private filterOptions: FilterOptions
  private putOptionsTable: GlobTable<S3PutModifier>
  private deleteOptionsTable: GlobTable<S3DeleteModifier>

  private diffBy?: DiffKey = 'size'

  private wildcardPolicy: WildcardPolicy = 'majority'
  private wildcardAll: boolean = false
  private invalidateDeletes: boolean = true

  private errorOnInvalidationPayment: boolean = true

  constructor(options: SyncerOptions) {
    this.source = parseContainerFromURL(options.source)
    this.target = parseContainerFromURL(options.target)
    this.filterOptions = { include: options.include, exclude: options.exclude }
    this.putOptionsTable = new GlobTable<S3PutModifier>(options.putOptions || {})
    this.deleteOptionsTable = new GlobTable<S3DeleteModifier>(options.deleteOptions || {})

    if (options.diffBy) {
      this.diffBy = options.diffBy
    }
  }

  public async sync(): Promise<SyncerStats> {
    const stats = new SyncerStats()
    const diffs = await diff(this.source, this.target, this.diffBy, this.filterOptions)
    const transfer = new Transfer({
      source: this.source,
      target: this.target,
      diffs,
    })
    let invalidations: string[] | undefined
    let invalidator: CloudFrontInvalidator | undefined
    // Give diffs to `stats`
    stats.diffs = diffs

    // Set up tranfer
    transfer
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


    // Set Up invalidator, if we're pushing to S3
    if (isS3Container(this.target)) {
      invalidations = generationInvalidations({
        diffs,
        targetItems: await this.target.listItems(),
        wildcardPolicy: this.wildcardPolicy,
        wildcardAll: this.wildcardAll,
        invalidateDeletes: this.invalidateDeletes,
      })
      invalidator = new CloudFrontInvalidator({
        bucketName: this.target.getBucketName(),
        paths: invalidations,
      })

      stats.invalidations = invalidations
      stats.distributions = await invalidator.getDistributions()

      const constitutesPayment = await invalidator.constitutesPayment()
      if (constitutesPayment && this.errorOnInvalidationPayment) {
        throw new SyncerErrors.TooManyInvalidations()
      }
    }

    try {
      await transfer.complete()
    } catch (err) {
      throw new SyncerErrors.TransferFailed(err)
    }

    if (invalidator) {
      try {
        invalidator.invalidate()
      } catch (err) {
        throw new SyncerErrors.InvalidationsFailed(err)
      }
    }

    return stats
  }
}