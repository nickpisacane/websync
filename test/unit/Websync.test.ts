import * as path from 'path'
import { S3 } from 'aws-sdk'
import { expect } from 'chai'

import Websync from '../../src/Websync'
import {
  clearBucketCache,
  createDistribution,
  clearDistributions,
} from '../awsMocks'

const s3 = new S3()

describe('Websync', () => {
  before(async () => {
    await s3.createBucket({
      Bucket: 'websync-test',
    }).promise()

    createDistribution({ bucketOrigin: 'websync-test' })

    await s3.putObject({
      Bucket: 'websync-test',
      Body: new Buffer('hello, s3'),
      Key: 'bang/deleteMe.txt',
    }).promise()
  })

  after(() => {
    clearBucketCache()
    clearDistributions()
  })

  it('lifecycle', async () => {
    const websync = new Websync({
      source: path.join(__dirname, 'fixtures', 'testDirectory'),
      target: 's3://websync-test',
    })

    await websync.initialize()
    expect(websync.constitutesPayment()).to.equal(false)
    const preStats = websync.getStats()
    expect(preStats.completed).to.equal(false)
    expect(preStats.distributions).to.have.length(1)
    expect(preStats.invalidations).to.deep.equal([
      '/bang*',
    ])
    const stats = await websync.sync()
    expect(stats.completed).to.equal(true)
    try {
      const r = await s3.getObject({
        Bucket: 'websync-test',
        Key: 'bang/deleteMe.txt',
      }).promise()
      throw new Error('FAILED')
    } catch (err) {
      expect(err.message).to.equal('NoSuchKey: The specified key does not exist.')
    }
  })
})