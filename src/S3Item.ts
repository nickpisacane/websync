import { S3 } from 'aws-sdk'
import Item from './Item'

export default class S3Item implements Item {
  public key: string
  public modtime: Date
  public size: number
  public isSymbolicLink: boolean
  private s3Object: S3.Object

  constructor(s3Object: S3.Object) {
    this.s3Object = s3Object
    if (!s3Object.Key) {
      throw new Error(`S3Item: Key is required on s3Object`)
    }
    if (typeof s3Object.LastModified === 'undefined') {
      throw new Error(`S3Item: LastModified is required on s3Object`)
    }
    if (typeof s3Object.Size !== 'number') {
      throw new Error(`S3Item: Size is required on s3Object`)
    }
    this.key = s3Object.Key
    this.modtime = s3Object.LastModified
    this.size = s3Object.Size
    this.isSymbolicLink = false
  }

  private async getBody(): Promise<Buffer> {

  }
}