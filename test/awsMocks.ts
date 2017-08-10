import { config, S3, Request, AWSError, CloudFront } from 'aws-sdk'
import * as AWS from 'aws-sdk' // used to get `apiLoader`
import * as faker from 'faker'
import * as mime from 'mime'
import * as _ from 'lodash'
import * as sinon from 'sinon'

config.update({
  accessKeyId: 'NOT AN ACCESS KEY',
  secretAccessKey: 'NOT A SECRET KEY',
  region: 'us-east-1',
})

function awsNotMockedMethod(params?: any, callback?: any): any {
  const err = new Error('Method not mocked')

  let _callback: any
  if (params && typeof params === 'function') _callback = params
  if (callback && typeof callback === 'function') _callback = callback
  if (_callback) {
    return _callback(err)
  }

  return {
    promise: () => Promise.reject(err),
  }
}

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

const mockedS3Methods = patchMethods.concat(['createBucket'])
const s3Proto = S3.prototype as any
const s3API = (AWS as any).apiLoader.services.s3['2006-03-01'].operations
Object.keys(s3API).forEach(key => {
  key = _.camelCase(key)
  if (!~mockedS3Methods.indexOf(key)) {
    s3Proto[key] = awsNotMockedMethod
  }
})
s3Proto.validateService = () => {}

// CloudFront Mocks for:
// cloudFront.listDistributions
// cloudFront.createInvalidation

export interface MockCloudFrontDistribution {
  id: string
  bucketOrigin?: string
  enabled: boolean
}

export let distributions: MockCloudFrontDistribution[] = []

export const clearDistributions = () => { distributions = [] }

export const createDistribution = (options: Partial<MockCloudFrontDistribution>): MockCloudFrontDistribution => {
  const id = faker.random.uuid()
  const dist: MockCloudFrontDistribution = Object.assign({
    id,
    enabled: !!options.enabled,
  }, options)

  distributions.push(dist)

  return dist
}

CloudFront.prototype.listDistributions = function(params: any = {}, callback?: any): Request<CloudFront.ListDistributionsResult, AWSError> {
  const p = params as CloudFront.ListDistributionsRequest
  const maxItems = p.MaxItems ? parseInt(p.MaxItems, 10) : 2

  let startIndex = 0
  if (p.Marker) {
    const index = _.findIndex(distributions, { id: p.Marker })
    if (~index) {
      startIndex = index + 1
    }
  }

  const dists = distributions.slice(startIndex, startIndex + maxItems)
  const last: MockCloudFrontDistribution | undefined = _.last(dists)
  const globalLast = _.last(distributions)

  const result = {
    DistributionList: {
      Marker: p.Marker,
      NextMarker: last ? last.id : '',
      MaxItems: maxItems,
      IsTruncated: last && globalLast ? last.id !== globalLast.id : false,
      Quantity: dists.length,
      Items: dists.map((dist): CloudFront.DistributionSummary => {
        const ret = {
          Id: dist.id,
          ARN: 'NOT AN ARN',
          Status: 'Deployed',
          Enabled: dist.enabled,
        } as CloudFront.DistributionSummary

        if (dist.bucketOrigin) {
          ret.Origins = {
            Quantity: 1,
            Items: [
              {
                Id: faker.random.uuid(),
                DomainName: `${dist.bucketOrigin}.s3.amazonaws.com`,
              },
            ],
          }
        }

        return ret
      }),
    },
  } as CloudFront.ListDistributionsRequest

  const request = {
    promise: () => Promise.resolve(result),
  } as Request<CloudFront.ListDistributionsResult, AWSError>

  return request
}

export const createInvalidationStub = sinon.stub()

CloudFront.prototype.createInvalidation = function(params?: any, callback?: any): Request<CloudFront.CreateInvalidationResult, AWSError> {
  const p = params as CloudFront.CreateInvalidationRequest
  createInvalidationStub(params)

  const result: CloudFront.CreateInvalidationResult = {
    Location: 'NOT A LOCATION',
    Invalidation: {
      Id: faker.random.uuid(),
      Status: 'Completed',
      CreateTime: new Date(),
      InvalidationBatch: params.InvalidationBatch,
    },
  }

  return {
    promise: () => Promise.resolve(result),
  } as Request<CloudFront.CreateInvalidationResult, AWSError>
}

const mockedCloudFrontMethods = [
  'listDistributions',
  'createInvalidation',
]

const cloudFrontProto = CloudFront.prototype as any
const cloudFrontAPI = (AWS as any).apiLoader.services.cloudfront['2017-03-25']
Object.keys(cloudFrontAPI.operations).forEach(key => {
  key = _.camelCase(key)
  if (!~mockedCloudFrontMethods.indexOf(key)) {
    cloudFrontProto[key] = awsNotMockedMethod
  }
})
cloudFrontProto.validateService = function() {}