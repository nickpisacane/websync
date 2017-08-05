import { EventEmitter } from 'events'
import { S3 } from 'aws-sdk'
import * as PQueue from 'p-queue'
import {
  Item,
  ItemDiff,
  Container,
  S3PutModifier,
  S3DeleteModifier,
} from './types'

interface TransferEmitter {
  emit(event: 'putObject', key: string, options: S3PutModifier): boolean
  on(event: 'putObject', listener: (key: string, options: S3PutModifier) => void): this

  emit(event: 'delObject', key: string, options: S3DeleteModifier): boolean
  on(event: 'delObject', listener: (key: string, options: S3DeleteModifier) => void): this
}

interface TransferOptions {
  source: Container
  target: Container
  diffs: ItemDiff[]
  concurrency?: number
}

export default class Transfer extends EventEmitter implements TransferEmitter {
  private source: Container
  private target: Container
  private diffs: ItemDiff[]
  private concurrency: number

  constructor(options: TransferOptions) {
    super()

    this.source = options.source
    this.target = options.target
    this.diffs = options.diffs
    this.concurrency = options.concurrency || 10
  }

  public complete(): Promise<any> {
    const queue = new PQueue({ concurrency: this.concurrency })
    return Promise.all(
      this.diffs.map(diff => {
        return queue.add(async () => {
          if (diff.type === 'DELETE') {
            const s3Options: S3DeleteModifier = {}
            const targetItem = diff.target
            this.emit('delObject', targetItem.key, s3Options)
            await this.target.delItem(targetItem, { s3Options })
          } else {
            const s3Options: S3PutModifier = {}
            const sourceItem = diff.source
            this.emit('putObject', sourceItem.key, s3Options)
            await this.target.putItem(sourceItem, { s3Options })
          }
        })
      })
    )
  }
}