import { expect } from 'chai'
import * as AWS from 'aws-sdk'

import { bucketCache, clearBucketCache, MockS3Bucket, MockS3Object } from '../awsMocks'

describe('awsMocks', () => {
  const s3 = new AWS.S3()
  const Bucket = 'TEST_TEST_BUCKET'

  after(() => clearBucketCache())

  it('mocks s3.createBucket', async () => {
    await s3.createBucket({ Bucket })
    expect(Bucket in bucketCache).to.equal(true)
    expect(bucketCache[Bucket]).to.be.instanceof(MockS3Bucket)
  })

  it('mocks s3.putObject', async () => {
    await s3.putObject({
      Bucket,
      Key: 'foo.txt',
      Body: new Buffer('foo'),
    }).promise()

    const bucket = bucketCache[Bucket] as MockS3Bucket
    const obj = await bucket.getObject({ Bucket, Key: 'foo.txt' })
    expect((obj.Body as Buffer).toString()).to.equal('foo')
  })

  it('mocks s3.getObject', async () => {
    const obj = await s3.getObject({ Bucket, Key: 'foo.txt' }).promise()
    expect((obj.Body as Buffer).toString()).to.equal('foo')
  })

  it('mocks s3.headObject', async () => {
    const head = await s3.headObject({ Bucket, Key: 'foo.txt' }).promise()
    expect(head.LastModified).to.be.instanceof(Date)
    expect(head.ContentLength).to.equal(3)
    expect(head.ETag).to.be.a('string')
  })

  it('mocks s3.listObjectsV2', async () => {
    const res = await s3.listObjectsV2({ Bucket }).promise()
    if (!res.Contents) {
      throw new Error('Failed s3.listObjectsV2')
    }
    expect(res.Contents).to.have.length(1)
    expect(res.Contents[0].Key).to.equal('foo.txt')
  })

  it('mocks s3.deleteObject', async () => {
    await s3.deleteObject({Bucket, Key: 'foo.txt'}).promise()
    try {
      await s3.getObject({ Bucket, Key: 'foo.txt' }).promise()
      throw new Error('FAILED')
    } catch (err) {
      expect(err.message).to.not.equal('FAILED')
    }
  })

  it('mocks s3.listObjectsV2 (large iteration)', async () => {
    await s3.createBucket({ Bucket: 'LIST' }).promise()
    for (let i = 0; i < 2042; i++) {
      await s3.putObject({
        Bucket: 'LIST',
        Key: `obj_${i}`,
        Body: new Buffer(0),
      }).promise()
    }
    const mockBucket = bucketCache['LIST'] as MockS3Bucket
    expect(mockBucket.objects).to.have.length(2042)

    const first = await s3.listObjectsV2({
      Bucket: 'LIST',
    }).promise()
    if (!first.Contents) {
      throw new Error('First failed')
    }
    expect(first.Contents).to.have.length(1000)
    expect(first.NextContinuationToken).to.be.a('string')
    expect(first.IsTruncated).to.equal(true)
    console.log(first.NextContinuationToken)

    const second = await s3.listObjectsV2({
      Bucket: 'LIST',
      ContinuationToken: first.NextContinuationToken,
    }).promise()
    if (!second.Contents) {
      throw new Error('Second failed')
    }
    expect(second.Contents).to.have.length(1000)
    expect(second.NextContinuationToken).to.be.a('string')
    expect(second.IsTruncated).to.equal(true)

    const third = await s3.listObjectsV2({
      Bucket: 'LIST',
      ContinuationToken: second.NextContinuationToken,
    }).promise()
    if (!third.Contents) {
      throw new Error('Third failed')
    }
    expect(third.Contents).to.have.length(42)
    expect(third.NextContinuationToken).to.be.a('string')
    expect(third.IsTruncated).to.equal(false)
  })

  it('should fail for everything else', async () => {
    try {
      await s3.listBuckets().promise()
      throw new Error('FAILED')
    } catch (err) {
      expect(err.code).to.equal('InvalidAccessKeyId')
    }
  })
})