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

    // TODO: Create some objects on "S3"
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

    let stats = await websync.initialize()
    stats = await websync.sync()

    // TODO: validate results
  })
})