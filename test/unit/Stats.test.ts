import { expect } from 'chai'
import * as AWS from 'aws-sdk'

import Stats from '../../src/Stats'
import { ItemDiff, Container } from '../../src/types'
import { MockItem } from '../utils'


describe('Stats', () => {
  it('toString()',  async () => {

    const diffs: ItemDiff[] = [
      {
        type: 'UPDATE',
        key: 'foo/bar',
        source: new MockItem(),
        target: new MockItem(),
      },
      {
        type: 'UPDATE',
        key: 'foo/bang',
        source: new MockItem(),
        target: new MockItem(),
      },
    ]

    const distributions: AWS.CloudFront.DistributionSummary[] = [
      {
        Id: 'FAKE ID',
        ARN: 'FAKE ARN',
        Status: 'Deployed',
        LastModifiedTime: new Date(),
        DomainName: 'foo.bar',
        Aliases: [''],
        Origins: ['aws.s3.test-target'],
      } as any,
    ]

    const invalidations: string[] = [
      '/*',
    ]

    const stats = new Stats({
      source: './test-source',
      target: 's3://test-target',
      diffs,
      distributions,
      invalidations,
      completed: true,
      invalidated: true,
      time: 100,
    })

    const str = stats.toString()
    expect(str).to.be.a('string')
  })
})