import { S3 } from 'aws-sdk'
import { Item } from './types'

const s3 = new S3()

export default class S3Item implements Item {
  private s3Object: S3.Object
  private bucketName: string

  public key: string
  public modtime: Date
  public size: number
  public isSymbolicLink: boolean
  

  constructor(bucketName: string, s3Object: S3.Object) {
    this.bucketName = bucketName
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
    const objectOutput = await s3.getObject({
      Bucket: this.bucketName,
      Key: this.s3Object.Key as string,
    }).promise()

    let ret: Buffer
    const body = objectOutput.Body
    if (typeof body === 'string') {
      ret = new Buffer(body)
    } else if (body instanceof Uint8Array) {
      ret = Buffer.from(body.buffer)
    } else {
      ret = new Buffer(0)
    }

    return ret
  }

  public read(): Promise<Buffer> {
    return this.getBody()
  }
}