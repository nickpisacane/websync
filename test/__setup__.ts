import { config, S3 } from 'aws-sdk'
import * as faker from 'faker'

config.update({
  accessKeyId: 'NOT AN ACCESS KEY',
  secretAccessKey: 'NOT A SECRET KEY',
  region: 'us-east-1',
})

interface MockS3Object {
  Key: string
  LastModified: Date
  Size: number
  Body: Buffer
}

class MockS3Bucket {
  private objects: MockS3Object[]

  public getObject(params: S3.GetObjectRequest): Promise<S3.GetObjectOutput> {
    for (let i = 0; i < this.objects.length; i++) {
      if (params.Key === this.objects[i].Key) {
        const obj = this.objects[i]
        const ret: S3.GetObjectOutput = {
          Body: obj.Body,
        }
      }
    }

    return Promise.reject(new Error('No Object'))
  }

  public putObject(params: S3.PutObjectRequest): Promise<S3.PutObjectOutput> {
    const body = params.Body as Buffer
    const mockObj: MockS3Object = {
      Key: params.Key,
      Body: body,
      LastModified: new Date(),
      Size: body.length,
    }

    let hasObject = false
    for (let i = 0; i < this.objects.length; i++) {
      if (params.Key === this.objects[i].Key) {
        hasObject = true
        this.objects[i] = mockObj
        break
      }
    }

    if (!hasObject) {
      this.objects.push(mockObj)
    }

    const ret: S3.PutObjectOutput = {}
    return Promise.resolve(ret)
  }

  // TODO: Delete Object, and List Object (V2_)
}