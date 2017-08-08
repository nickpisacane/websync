import { expect } from 'chai'

import generateInvalidations, {
  match,
  isInvalidated,
  normalizeInvalidationPath,
  WildcardPolicy,
} from '../../src/generateInvalidations'
import diff from '../../src/diff'
import {
  MockItem,
  MockSuite,
} from '../utils'

const expectInvalidation = (invalidations: string[], path: string) => {
  expect(invalidations.indexOf(path)).to.not.equal(-1)
}

describe('generateInvalidations', () => {
  const basicInvalidations = async (policy: WildcardPolicy): Promise<string[]> => {
    const suite = new MockSuite()
    const diffs = await diff(suite.sourceContainer, suite.targetContainer)
    const targetItems = await suite.targetContainer.listItems()
    return generateInvalidations({
      diffs,
      targetItems,
      wildcardPolicy: policy,
    })
  }

  // @see: http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html#invalidation-specifying-objects
  it('match()', () => {
    // all objects in directory
    let pattern = '/foo/*'
    expect(match('/foo/bar.txt', pattern)).to.equal(true)
    expect(match('/foo/bang/baz.txt', pattern)).to.equal(false)

    // all objects in directory and subdirectory
    pattern = '/foo*'
    expect(match('/foo/bar.txt', pattern)).to.equal(true)
    expect(match('/foo/bang/baz.txt', pattern)).to.equal(true)

    // all files
    pattern = '/img*'
    expect(match('/img_1.jpg', pattern)).to.equal(true)
    expect(match('/img_2.jpg', pattern)).to.equal(true)
    pattern = '/foo.js*'
    expect(match('/foo.js?version=1', pattern)).to.equal(true)
    expect(match('/foo.js?foo=bar', pattern)).to.equal(true)

    // all objects
    pattern = '/*'
    expect(match('foo.txt', pattern)).to.equal(true)
    expect(match('/bar/bang/bax.jpg', pattern)).to.equal(true)
  })

  it('isInvalidated()', () => {
    const invalidations = [
      '/foo/bar/*',
      '/bang.txt',
      '/baz/a/b/*',
      '/imgs/image*',
      '/js*',
    ]

    expect(isInvalidated('/foo/bar/bang.txt', invalidations)).to.equal(true)
    expect(isInvalidated('foo/bar/bang.txt', invalidations)).to.equal(true)
    expect(isInvalidated('/foo/bar/boo/bar.js', invalidations)).to.equal(false)

    expect(isInvalidated('/bang.txt', invalidations)).to.equal(true)
    expect(isInvalidated('bang.txt', invalidations)).to.equal(true)

    expect(isInvalidated('/baz/a/b/bang.txt', invalidations)).to.equal(true)
    expect(isInvalidated('baz/a/b/bang.txt', invalidations)).to.equal(true)
    expect(isInvalidated('/baz/a/b/c/d/bang.txt', invalidations)).to.equal(false)
    expect(isInvalidated('baz/a/b/c/d/bang.txt', invalidations)).to.equal(false)

    expect(isInvalidated('/imgs/image_1.png', invalidations)).to.equal(true)
    expect(isInvalidated('imgs/image_1.png', invalidations)).to.equal(true)

    expect(isInvalidated('/js/vendor/lib.js?version=1', invalidations)).to.equal(true)
    expect(isInvalidated('/js/bar.js', invalidations)).to.equal(true)
  })

  it('normalizeInvalidationPath()', () => {
    expect(normalizeInvalidationPath('foo')).to.equal('/foo')
    expect(normalizeInvalidationPath('foo', true)).to.equal('/foo*')
    expect(normalizeInvalidationPath('foo/', true)).to.equal('/foo/*')
    expect(normalizeInvalidationPath('/foo/', true)).to.equal('/foo/*')
    expect(normalizeInvalidationPath('foo/*', true)).to.equal('/foo/*')
    expect(normalizeInvalidationPath('foo*', true)).to.equal('/foo*')
  })

  it('basic invalidations with policy = "majority"', async () => {
    const invalidations = await basicInvalidations('majority')

    expect(invalidations).to.have.length(2)
    // update.html => /update.html
    expectInvalidation(invalidations, '/update.html')
    // i/am/deleted.css => /i*
    expectInvalidation(invalidations, '/i*')
  })

  it('basic invalidations with policy = "minority"', async () => {
    const invalidations = await basicInvalidations('minority')

    expect(invalidations).to.have.length(2)
    // update.html => /update.html
    expectInvalidation(invalidations, '/update.html')
    // i/am/deleted.css => /i*
    expectInvalidation(invalidations, '/i*')
  })

  it('basic invalidations with policy = "unanimous"', async () => {
    const invalidations = await basicInvalidations('unanimous')

    expect(invalidations).to.have.length(2)
    // update.html => /update.html
    expectInvalidation(invalidations, '/update.html')
    // i/am/deleted.css => /i*
    expectInvalidation(invalidations, '/i*')
  })
})