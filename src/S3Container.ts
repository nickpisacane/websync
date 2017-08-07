import { S3 } from 'aws-sdk'
import * as minimatch from 'minimatch'
import S3Item from './S3Item'
import {
  Item,
  Container,
  ContainerType,
  ListItemsOptions,
  PutItemOptions,
  DelItemOptions,
} from './types'

const s3 = new S3()
const MAX_LIST_OBJECTS = 1000

export default class S3Container implements Container {
  private bucketName: string

  public type: ContainerType = 'S3'

  constructor(bucketName: string) {
    this.bucketName = bucketName
  }

  private async listAllObjects(): Promise<S3.Object[]> {
    let continuationToken: string | undefined
    let objects: S3.Object[] = []
    let done = false

    while (!done) {
      const params: S3.ListObjectsV2Request = {
        Bucket: this.bucketName,
      }
      if (continuationToken) {
        params.ContinuationToken = continuationToken
      }
      const res = await s3.listObjectsV2(params).promise()
      const newObjects = res.Contents
      if (newObjects) {
        objects = objects.concat(newObjects)
      }

      if (res.IsTruncated) {
        continuationToken = res.NextContinuationToken
      } else {
        done = true
      }
    }

    return objects
  }

  public async listItems(options: ListItemsOptions = {}): Promise<Item[]> {
    let objects = await this.listAllObjects()
    if (options.include) {
      objects = objects.filter(obj => obj.Key && minimatch(obj.Key, options.include as string))
    }
    if (options.exclude) {
      objects = objects.filter(obj => obj.Key && !minimatch(obj.Key, options.exclude as string))
    }
    return objects.map(obj => new S3Item(this.bucketName, obj))
  }

  public async putItem(item: Item, options?: PutItemOptions): Promise<Item> {
    const body = await item.read()
    const s3Options = options && options.s3Options ? options.s3Options : {}
    const params: S3.PutObjectRequest = Object.assign(s3Options, {
      Bucket: this.bucketName,
      Key: item.key,
      Body: body,
    })
    const objectOutput = await s3.putObject(params).promise()
    const objectHead = await s3.headObject({
      Bucket: this.bucketName,
      Key: item.key,
    }).promise()
    const s3Object: S3.Object = {
      Key: item.key,
      LastModified: objectHead.LastModified,
      Size: body.length,
    }
    const ret: Item = new S3Item(item.key, s3Object)

    return ret
  }

  public async delItem(item: Item, options?: DelItemOptions): Promise<void> {
    const s3Options = options && options.s3Options ? options.s3Options : {}
    const params: S3.DeleteObjectRequest = Object.assign(s3Options, {
      Bucket: this.bucketName,
      Key: item.key,
    })
    await s3.deleteObject(params).promise()
  }
}