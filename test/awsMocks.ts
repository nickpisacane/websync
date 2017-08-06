import { config, S3, Request, AWSError } from 'aws-sdk'
import * as faker from 'faker'
import * as mime from 'mime'

config.update({
  accessKeyId: 'NOT AN ACCESS KEY',
  secretAccessKey: 'NOT A SECRET KEY',
  region: 'us-east-1',
})

export interface MockS3Object {
  Key: string
  LastModified: Date
  Size: number
  Body: Buffer
}

export class MockS3Bucket {
  public objects: MockS3Object[] = []

  private getMockObject(key: string): MockS3Object| undefined {
    for (let i = 0; i < this.objects.length; i++) {
      if (key === this.objects[i].Key) {
        return this.objects[i]
      }
    }
  }

  public getObject(params: S3.GetObjectRequest): Promise<S3.GetObjectOutput> {
    const obj = this.getMockObject(params.Key)
    if (obj) {
      const ret: S3.GetObjectOutput = {
        Body: obj.Body,
        LastModified: obj.LastModified,
        ContentLength: obj.Size,
        ETag: 'NOT AN ETAG',
        ContentType: mime.lookup(obj.Key),
        Metadata: {},
      }

      return Promise.resolve(ret)
    }

    return Promise.reject(new Error('NoSuchKey: The specified key does not exist.'))
  }

  public putObject(params: S3.PutObjectRequest): Promise<S3.PutObjectOutput> {
    const body = params.Body as Buffer
    const mockObj: MockS3Object = {
      Key: params.Key,
      Body: body,
      LastModified: new Date(),
      Size: body.length,
    }

    const existingObj = this.getMockObject(params.Key)
    if (existingObj) {
      this.objects[this.objects.indexOf(existingObj)] = mockObj
    } else {
      this.objects.push(mockObj)
    }

    const ret: S3.PutObjectOutput = {}
    return Promise.resolve(ret)
  }

  public headObject(params: S3.HeadObjectRequest): Promise<S3.HeadObjectOutput> {
    const obj = this.getMockObject(params.Key)
    if (obj) {
      const ret: S3.HeadObjectOutput = {
        LastModified: obj.LastModified,
        ContentLength: obj.Size,
        ETag: 'NOT AN ETAG',
        ContentType: mime.lookup(obj.Key),
        Metadata: {},
      }
      return Promise.resolve(ret)
    }

    return Promise.reject(new Error('Not Found'))
  }

  public deleteObject(params: S3.DeleteObjectRequest): Promise<S3.DeleteObjectOutput> {
    const obj = this.getMockObject(params.Key)
    if (obj) {
      const index = this.objects.indexOf(obj)
      this.objects.splice(index, 1)
    }

    const ret: S3.DeleteObjectOutput = {}
    return Promise.resolve(ret)
  }

  public listObjectsV2(params: S3.ListObjectsV2Request): Promise<S3.ListObjectsV2Output> {
    const maxKeys = params.MaxKeys || 1000

    let startIndex = 0
    const startKey = params.StartAfter || params.ContinuationToken
    if (startKey) {
      const obj = this.getMockObject(startKey)
      if (obj) {
        startIndex = this.objects.indexOf(obj) + 1
      }
    }

    const objects = this.objects.slice(startIndex, startIndex + maxKeys)
    const Contents: S3.Object[] = objects.map((obj): S3.Object => ({
      Key: obj.Key,
      LastModified: obj.LastModified,
      Size: obj.Size,
      StorageClass: 'STANDARD',
      ETag: 'NOT AN ETag',
    }))
    const NextContinuationToken = Contents.length
      ? Contents[Contents.length - 1].Key
      : this.objects[this.objects.length - 1].Key
    const ret: S3.ListObjectsV2Output = {
      MaxKeys: maxKeys,
      KeyCount: Contents.length,
      Contents: Contents,
      IsTruncated: Contents[Contents.length - 1].Key !== this.objects[this.objects.length - 1].Key,
      NextContinuationToken,
    }

    return Promise.resolve(ret)
  }
}

export let bucketCache: {
  [key: string]: MockS3Bucket
} = {}

export const clearBucketCache = () => {
  bucketCache = {}
}

const promiseToRequest = <T> (promise: Promise<T>): Request<T, AWSError> => {
  return {
    promise: () => promise,
  } as Request<T, AWSError>
}

const patchS3Method = (methodName: string): void => {
  const proto = S3.prototype as { [key: string]: any }
  proto[methodName] = function(params?: any, callback?: any): Request<any, AWSError> {
    const bucketName = params.Bucket as string
    const bucket = bucketCache[bucketName] as { [key: string]: any }
    if (!bucket) {
      return promiseToRequest<any>(Promise.reject(new Error(`No bucket: "${bucketName}"`)))
    }
    return promiseToRequest<any>(bucket[methodName](params))
  }
}

// Mock `createBucket`
S3.prototype.createBucket = function(
  params?: any,
  callback?: any
): Request<S3.CreateBucketOutput, AWSError> {
  const p = params as S3.CreateBucketRequest
  const output: S3.CreateBucketOutput = {}
  if (!bucketCache[p.Bucket]) {
    bucketCache[p.Bucket] = new MockS3Bucket()
  }
  return promiseToRequest<S3.CreateBucketOutput>(Promise.resolve(output))
}

const patchMethods = [
  'getObject',
  'putObject',
  'headObject',
  'deleteObject',
  'listObjectsV2',
]

patchMethods.forEach(methodName => patchS3Method(methodName))