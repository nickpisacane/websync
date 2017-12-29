import * as path from 'path'
import { S3 } from 'aws-sdk'
import * as minimatch from 'minimatch'
import * as mime from 'mime'
import S3Prefixer from './S3Prefixer'
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

export default class S3Container extends S3Prefixer implements Container {
  private bucketName: string
  public type: ContainerType = 'S3'

  constructor(bucketName: string, prefix: string = '') {
    super(prefix)
    this.bucketName = bucketName
  }

  private async listAllObjects(): Promise<S3.Object[]> {
    let continuationToken: string | undefined
    let objects: S3.Object[] = []
    let done = false

    while (!done) {
      const params: S3.ListObjectsV2Request = {
        Bucket: this.bucketName,
        Prefix: this.prefix,
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

    objects.forEach(obj => {
      if (obj.Key) {
        obj.Key = this.withoutPrefix(obj.Key)
      }
    })

    return objects
  }

  public async listItems(options: ListItemsOptions = {}): Promise<Item[]> {
    let objects = await this.listAllObjects()
    const { include, exclude } = options
    if (include) {
      objects = objects.filter(obj => obj.Key && minimatch(obj.Key, include, { matchBase: true }))
    }
    if (exclude) {
      objects = objects.filter(obj => obj.Key && !minimatch(obj.Key, exclude, { matchBase: true }))
    }

    return objects.map(obj => new S3Item(this.bucketName, obj))
  }

  public async putItem(item: Item, options?: PutItemOptions): Promise<Item> {
    const body = await item.read()
    const s3Options = options && options.s3Options ? options.s3Options : {}
    const key = this.withPrefix(item.key)
    const params: S3.PutObjectRequest = Object.assign(s3Options, {
      Bucket: this.bucketName,
      Key: key,
      Body: body,
    })
    if (!params.ContentType) {
      params.ContentType = mime.getType(key) || 'application/octet-stream'
    }
    const objectOutput = await s3.putObject(params).promise()
    const objectHead = await s3.headObject({
      Bucket: this.bucketName,
      Key: key,
    }).promise()
    const s3Object: S3.Object = {
      Key: key,
      LastModified: objectHead.LastModified,
      Size: body.length,
    }
    const ret: Item = new S3Item(item.key, s3Object)

    return ret
  }

  public async delItem(item: Item, options?: DelItemOptions): Promise<void> {
    const s3Options = options && options.s3Options ? options.s3Options : {}
    const key = this.withPrefix(item.key)
    const params: S3.DeleteObjectRequest = Object.assign(s3Options, {
      Bucket: this.bucketName,
      Key: key,
    })
    await s3.deleteObject(params).promise()
  }

  public getBucketName(): string {
    return this.bucketName
  }
}