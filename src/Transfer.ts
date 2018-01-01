import { S3 } from 'aws-sdk'
import * as PQueue from 'p-queue'

import AsyncEventEmitter from './AsyncEventEmitter'
import {
  Item,
  ItemDiff,
  Container,
  S3PutModifier,
  S3DeleteModifier,
} from './types'

export interface TransferItemCompleteEvent {
  type: ItemDiff['type']
  item: Item
  success: boolean
  time: number
}

export interface TransferEmitter {
  emit(event: 'putObject', item: Item, options: S3PutModifier): Promise<boolean>
  on(event: 'putObject', listener: (key: string, options: S3PutModifier) => void): this

  emit(event: 'delObject', item: Item, options: S3DeleteModifier): Promise<boolean>
  on(event: 'delObject', listener: (key: string, options: S3DeleteModifier) => void): this

  emit(event: 'itemComplete', data: TransferItemCompleteEvent): Promise<boolean>
  on(event: 'itemComplete', listener: (data: TransferItemCompleteEvent) => void): this
}

export interface TransferOptions {
  source: Container
  target: Container
  diffs: ItemDiff[]
  concurrency?: number
}

export default class Transfer extends AsyncEventEmitter implements TransferEmitter {
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

  private async completeItem(
    start: number,
    type: ItemDiff['type'],
    item: Item,
    promise: Promise<any>
  ): Promise<void> {
    let success = true
    try {
      await promise
    } catch (err) {
      success = false
    }
    const end = Date.now()
    const eventData: TransferItemCompleteEvent = {
      type,
      item,
      success,
      time: end - start,
    }
    await this.emit('itemComplete', eventData)
  }

  public complete(): Promise<any> {
    const queue = new PQueue({ concurrency: this.concurrency })
    return Promise.all(
      this.diffs.map(diff => {
        return queue.add(async () => {
          if (diff.type === 'DELETE') {
            const s3Options: S3DeleteModifier = {}
            const targetItem = diff.target

            await this.emit('delObject', targetItem, s3Options)
            await this.completeItem(
              Date.now(),
              diff.type,
              targetItem,
              this.target.delItem(targetItem, { s3Options })
            )
          } else {
            const s3Options: S3PutModifier = {}
            const sourceItem = diff.source

            await this.emit('putObject', sourceItem, s3Options)
            await this.completeItem(
              Date.now(),
              diff.type,
              sourceItem,
              this.target.putItem(sourceItem, { s3Options })
            )
          }
        })
      })
    )
  }
}