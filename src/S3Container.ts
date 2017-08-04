import { S3 } from 'aws-sdk'
import { Item, Container, ListItemsOptions, ContainerType } from './types'

const s3 = new S3()
const MAX_LIST_OBJECTS = 1000

export default class S3Container implements Container {
  private bucketName: string

  public type: ContainerType = 'S3'

  constructor(bucketName: string) {
    this.bucketName = bucketName
  }

  private async listAllObjects(): Promise<S3.Object[]> {
    let startAfter: string | undefined
    let objects: S3.Object[] = []

    while (true) {
      const params: S3.ListObjectsV2Request = {
        Bucket: this.bucketName,
      }
      if (startAfter) {
        params.StartAfter = startAfter
      }
      const res = await s3.listObjectsV2(params).promise()
      const newObjects = res.Contents
      if (newObjects) {
        startAfter = newObjects[newObjects.length - 1].Key
        objects = newObjects.concat(newObjects)
      }
      if (!newObjects || newObjects.length < MAX_LIST_OBJECTS) {
        break
      }
    }

    return objects
  }

  public listItems(options?: ListItemsOptions): Promise<Item> {

  }
}