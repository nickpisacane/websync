import * as path from 'path'
import { expect } from 'chai'
import { S3 } from 'aws-sdk'

import { Item } from '../../src/types'
import S3Container from '../../src/S3Container'
import { clearBucketCache } from '../awsMocks'

const createContainerTest = (prefix: string = '') => () => {
  const bucketName = 'S3_CONTAINER'
  const s3Container = new S3Container(bucketName, prefix)
  const s3 = new S3()
  const withPrefix = (key: string): string => path.join(prefix, key)

  before(async () => {
    await s3.createBucket({ Bucket: bucketName }).promise()
    await s3.putObject({
      Bucket: bucketName,
      Key: withPrefix('bang/baz.txt'),
      Body: new Buffer('foo'),
    }).promise()
    await s3.putObject({
      Bucket: bucketName,
      Key: withPrefix('bar.txt'),
      Body: new Buffer('bang'),
    }).promise()
    await s3.putObject({
      Bucket: bucketName,
      Key: withPrefix('foo.txt'),
      Body: new Buffer('bar'),
    }).promise()
  })

  after(() => clearBucketCache())

  it('listItems', async () => {
    const items = await s3Container.listItems()
    const expectedKeys = [
      'bang/baz.txt',
      'bar.txt',
      'foo.txt',
    ]
    const actualKeys = items.map(i => i.key)

    expect(actualKeys).to.have.length(expectedKeys.length)
    expect(
      expectedKeys.every(key => !!~actualKeys.indexOf(key))
    ).to.equal(true)

    const s3Items = await s3.listObjectsV2({
      Bucket: bucketName,
    }).promise()

    if (!s3Items.Contents) {
      throw new Error('Expected S3 Bucket to have items')
    }

    const s3Keys = s3Items.Contents.map(obj => obj.Key)
    expect(s3Keys).to.deep.equal(expectedKeys.map(k => withPrefix(k)))
  })

  it('putItem()', async () => {
    const body = new Buffer('Hello world')
    const item: Item = {
      key: 'bang/a/b/d.txt',
      modtime: new Date(),
      size: body.length,
      isSymbolicLink: false,
      read: () => Promise.resolve(body),
    }

    await s3Container.putItem(item)

    const obj = await s3.getObject({
      Bucket: bucketName,
      Key: withPrefix('bang/a/b/d.txt'),
    }).promise()

    expect((obj.Body as Buffer).toString()).to.equal('Hello world')

    await s3.deleteObject({
      Bucket: bucketName,
      Key: withPrefix('bang/a/b/d.txt'),
    }).promise()
  })

  it('delItem()', async () => {
    const body = new Buffer('Hello world')
    const item: Item = {
      key: 'test.txt',
      modtime: new Date(),
      size: body.length,
      isSymbolicLink: false,
      read: () => Promise.resolve(body),
    }

    await s3Container.putItem(item)

    await s3Container.delItem(item)

    try {
      await s3.getObject({
        Bucket: bucketName,
        Key: 'test.txt',
      }).promise()
      throw new Error('FAILED')
    } catch (err) {
      expect(/^NoSuchKey/.test(err.message)).to.equal(true)
    }
  })
}

describe('S3Container', () => {
  describe('S3Container:no-prefix', createContainerTest())
  describe('S3Container:prefixed', createContainerTest('test-prefix'))
})