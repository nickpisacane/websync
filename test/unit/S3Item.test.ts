import { S3 } from 'aws-sdk'
import { expect } from 'chai'

import S3Item from '../../src/S3Item'
import { clearBucketCache } from '../awsMocks'

describe('S3Item', () => {
  const s3 = new S3()
  const bucketName = 'TEST_S3_ITEM_BUCKET'
  const objKey = 'TEST_S3_ITEM_OBJECT'
  let s3Object: S3.Object

  before(async () => {
    await s3.createBucket({
      Bucket: bucketName,
    })

    const obj = await s3.putObject({
      Bucket: bucketName,
      Key: objKey,
      Body: new Buffer('Foo'),
    }).promise()

    const objects = await s3.listObjectsV2({ Bucket: bucketName }).promise()
    if (!objects.Contents || !objects.Contents.length) {
      throw new Error('No objects')
    }

    s3Object = objects.Contents[0]
  })

  after(() => clearBucketCache())

  it('properties', () => {
    const s3Item = new S3Item(bucketName, s3Object)
    expect(s3Item.modtime.getTime()).equals((s3Object.LastModified as Date).getTime())
    expect(s3Item.size).equals(s3Object.Size)
    expect(s3Item.isSymbolicLink).to.equal(false)
    expect(s3Item.key).to.equal(objKey)
  })

  it('read', async () => {
    const s3Item = new S3Item(bucketName, s3Object)
    const body = await s3Item.read()
    expect(body.toString()).to.equal('Foo')
  })
})