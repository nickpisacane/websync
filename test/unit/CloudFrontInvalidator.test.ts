import { expect } from 'chai'
import * as _ from 'lodash'

import CloudFrontInvalidator, {
  listDistributions,
  findDistributions,
} from '../../src/CloudFrontIndalidator'
import {
  createDistribution,
  distributions,
  clearDistributions,
  MockCloudFrontDistribution,
  createInvalidationStub,
} from '../awsMocks'

describe('CloudFrontInvalidator & Helpers', () => {
  describe('helpers', () => {
    describe('listDistributions()', () => {
      afterEach(() => clearDistributions())

      it('lists all distributions', async () => {
        const count = 10
        for (let i = 0; i < count; i++) createDistribution({})
        expect(distributions).to.have.length(10)

        const dists = await listDistributions()
        expect(dists).to.have.length(10)
      })
    })
    describe('findDistributions()', () => {
      afterEach(() => clearDistributions())

      it('find by bucketName', async () => {
        for (let i = 0; i < 5; i++) createDistribution({ bucketOrigin: `bucket_${i}` })

        const dists = await findDistributions({ bucketName: `bucket_3` })
        expect(dists).to.have.length(1)
        expect(dists[0].Origins.Quantity).to.equal(1)
        const first = dists[0]
        if (!first.Origins.Items || !first.Origins.Items.length) {
          throw new Error('Dist has no Origin Items')
        }
        expect(first.Origins.Items[0].DomainName).to.equal('bucket_3.s3.amazonaws.com')
      })

      it('finds by id', async () => {
        const dist1 = createDistribution({ bucketOrigin: 'bucket_1' })
        const dist2 = createDistribution({ bucketOrigin: 'bucket_2' })
        const dist3 = createDistribution({ bucketOrigin: 'bucket_3' })

        const dists = await findDistributions({ ids: [ dist1.id, dist3.id ] })
        expect(dists).to.have.length(2)
        const findDist1 = _.find(dists, { Id: dist1.id })
        const findDist2 = _.find(dists, { Id: dist3.id })
        if (!findDist1) {
          throw new Error('No dist associated with dist1')
        }
        if (!findDist2) {
          throw new Error('No dist associated with dist3')
        }
      })
    })
  })

  describe('CloudFrontInvalidator', () => {
    const enabled: MockCloudFrontDistribution[] = []
    const disabled: MockCloudFrontDistribution[] = []
    before(() => {
      for (let i = 0; i < 5; i++) {
        enabled.push(createDistribution({
          bucketOrigin: `bucket_${i}`,
          enabled: true,
        }))
      }
      for (let i = 0; i < 5; i++) {
        disabled.push(createDistribution({
          bucketOrigin: `bucket_disabled_${i}`,
          enabled: false,
        }))
      }
    })

    after(() => clearDistributions())

    afterEach(() => createInvalidationStub.reset())

    it('paths are unique-ified', () => {
      const invalidator = new CloudFrontInvalidator({
        bucketName: 'foo',
        paths: ['/', '/'],
      })
      expect(invalidator.paths).to.have.length(1)
    })

    it('getDistributions() finds distributions matching "bucketName"', async () => {
      const invalidator = new CloudFrontInvalidator({
        bucketName: 'bucket_0',
        paths: [],
      })

      const dists = await invalidator.getDistributions()
      expect(dists).to.have.length(1)
      const first = dists[0]
      if (!first.Origins.Items || !first.Origins.Items.length) {
        throw new Error('No origins for dist')
      }
      expect(first.Origins.Items[0].DomainName).to.equal(`bucket_0.s3.amazonaws.com`)
    })

    it('getDistributions() finds distributions by ids (overrides bucketName)', async () => {
      const explicitDist = enabled[1]
      const invalidator = new CloudFrontInvalidator({
        bucketName: 'bucket_0',
        paths: [],
        ids: [ explicitDist.id ],
      })

      const dists = await invalidator.getDistributions()
      expect(dists).to.have.length(1)
      const first = dists[0]
      if (!first.Origins.Items || !first.Origins.Items.length) {
        throw new Error('No origins for dist')
      }
      expect(first.Origins.Items[0].DomainName)
        .to.equal(`${explicitDist.bucketOrigin}.s3.amazonaws.com`)
    })

    it('constituesPayment() returns true, if more than 1000 total invalidations', async () => {
      const invalidator = new CloudFrontInvalidator({
        bucketName: 'bucket_1',
        paths: new Array(1001).fill('').map((p, i) => `/${i}`),
      })

      const constituesPayment = await invalidator.constitutesPayment()
      expect(constituesPayment).to.equal(true)
    })

    it('invalidate() does not create invalidations if no paths are given', async () => {
      const invalidator = new CloudFrontInvalidator({
        bucketName: 'bucket_1',
        paths: [],
      })

      const res = await invalidator.invalidate()
      expect(res.committed).to.equal(false)
      expect(res.count).to.equal(0)
      expect(res.reason).to.equal('NO_PATHS')
      expect(createInvalidationStub.called).to.equal(false)
    })

    it('invalidate() does not create invalidations if no distributions are found', async () => {
      const invalidator = new CloudFrontInvalidator({
        bucketName: 'nope',
        paths: ['/*'],
      })

      const res = await invalidator.invalidate()
      expect(res.committed).to.equal(false)
      expect(res.count).to.equal(0)
      expect(res.reason).to.equal('NO_DISTS')
      expect(createInvalidationStub.called).to.equal(false)
    })

    it('invalidate() by default only invalides on "enabled" distributions', async () => {
      const invalidator = new CloudFrontInvalidator({
        bucketName: 'bucket_disabled_1',
        paths: ['/*'],
      })

      const res = await invalidator.invalidate()
      expect(res.committed).to.equal(false)
      expect(res.count).to.equal(0)
      expect(res.reason).to.equal('NO_DISTS')
      expect(createInvalidationStub.called).to.equal(false)
    })

    it('invalidate() creates invalidations on cloudFront distributions', async () => {
      const invalidator = new CloudFrontInvalidator({
        bucketName: 'bucket_0',
        paths: ['/*'],
      })

      const res = await invalidator.invalidate()
      expect(res.committed).to.equal(true)
      expect(res.count).to.equal(1)
      expect(res.reason).to.equal('COMMITTED')

      const calledWith = createInvalidationStub.getCall(0).args[0]
      expect(calledWith.DistributionId).to.equal(enabled[0].id)
      expect(calledWith).to.have.property('InvalidationBatch')
      expect(calledWith.InvalidationBatch.Paths).to.deep.equal({
        Quantity: 1,
        Items: ['/*'],
      })
    })
  })
})