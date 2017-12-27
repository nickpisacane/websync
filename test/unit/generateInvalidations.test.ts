import { expect } from 'chai'
import * as faker from 'faker'

import { ItemDiff, ItemDiffType } from '../../src/types'
import generateInvalidations, {
  match,
  isInvalidated,
  normalizeInvalidationPath,
  WildcardPolicy,
  GenerateInvalidationsOptions,
} from '../../src/generateInvalidations'
import diff, { DiffKey } from '../../src/diff'
import {
  MockItem,
  MockSuite,
  MockContainer,
} from '../utils'

const expectInvalidation = (invalidations: string[], path: string) => {
  expect(invalidations.indexOf(path)).to.not.equal(-1)
}

interface KeyDiff {
  type: ItemDiffType | 'STATIC'
  key: string
}
type InvalidationTest = (policy: WildcardPolicy, diffKey?: DiffKey) => Promise<string[]>

const createInvalidationTest = (
  keyDiffs: KeyDiff[],
  options: Partial<GenerateInvalidationsOptions> = {}
): InvalidationTest => {
  const sizes: { [key: string]: number } = {}
  const modtimes: { [key: string]: Date } = {}

  const sourceItems: MockItem[] = keyDiffs
    .filter(kd => kd.type !== 'DELETE')
    .map(kd => {
      const size = sizes[kd.key] = faker.random.number({ min: 0, max: 128 })
      const modtime = modtimes[kd.key] = new Date()

      return new MockItem({
        key: kd.key,
        modtime,
        size,
      })
    })
  const targetItems: MockItem[] = keyDiffs
    .filter(kd => kd.type !== 'CREATE')
    .map(kd => {
      let size = (sizes[kd.key] || 0) + 128
      let modtime = faker.date.past()

      if (kd.type === 'STATIC') {
        if (!sizes[kd.key] || !modtimes[kd.key]) {
          throw new Error(`Expected size/modtime to exist for key: "${kd.key}"`)
        } else {
          size = sizes[kd.key]
          modtime = modtimes[kd.key]
        }
      }

      return new MockItem({
        key: kd.key,
        modtime,
        size,
      })
    })
  const sourceContainer = new MockContainer()
  const targetContainer = new MockContainer()

  sourceContainer.setItems(sourceItems)
  targetContainer.setItems(targetItems)

  return async (policy: WildcardPolicy, diffKey: DiffKey = 'modtime'): Promise<string[]> => {
    const diffs = await diff(sourceContainer, targetContainer, diffKey)

    return generateInvalidations(Object.assign(options, {
      diffs,
      targetItems,
      wildcardPolicy: policy,
    }))
  }
}

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

describe('generateInvalidations', () => {
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

  it('generates invalidations direct child invalidations when applicable', async () => {
    // on the basis of ALL of a's children majority/unanimous policy fails, but on the basis of DIRECT
    // children, majority/unanimous wins. Thus, expect a direct-child wildcard invalidtion: "/a/*"
    const test = createInvalidationTest([
      {
        type: 'UPDATE',
        key: 'a/update_1',
      },
      {
        type: 'UPDATE',
        key: 'a/update_2',
      },
      {
        type: 'STATIC',
        key: 'a/b/static_1',
      },
      {
        type: 'STATIC',
        key: 'a/b/static_2',
      },
      {
        type: 'STATIC',
        key: 'a/b/static_2',
      },
    ])

    const majorityInvalidations = await test('majority')
    expect(majorityInvalidations).to.have.length(1)
    expect(majorityInvalidations[0]).to.equal('/a/*')

    const unanimousInvalidations = await test('unanimous')
    expect(unanimousInvalidations).to.have.length(1)
    expect(unanimousInvalidations[0]).to.equal('/a/*')
  })

  it('option: invalidateDeletes = false', async () => {
    const test = createInvalidationTest([
      {
        type: 'DELETE',
        key: 'foo',
      },
    ], {
      invalidateDeletes: false,
    })

    const invalidations = await test('majority')
    expect(invalidations).to.have.length(0)
  })

  it('option: wildcardAll = true', async () => {
    const test = createInvalidationTest([
      {
        type: 'UPDATE',
        key: 'foo.txt',
      },
    ], {
      wildcardAll: true,
    })

    const invalidations = await test('majority')
    expect(invalidations).to.have.length(1)
    expect(invalidations[0]).to.equal('/foo.txt*')
  })

  it('it does not invalidate parent paths when unnecessary', async () => {
    const test = createInvalidationTest([
      {
        type: 'UPDATE',
        key: 'foo/bar/bang.txt',
      },
      {
        type: 'STATIC',
        key: 'foo/baz.txt',
      },
      {
        type: 'STATIC',
        key: 'foo/bar/boo.txt',
      },
    ])

    const invalidations = await test('majority')
    expect(invalidations).to.have.length(1)
    expect(invalidations[0]).to.equal('/foo/bar/bang.txt')
  })

  it('it does not invalidate parent paths when unnecessary (wildcardAll = true)', async () => {
    const test = createInvalidationTest([
      {
        type: 'UPDATE',
        key: 'foo/bar/bang.txt',
      },
      {
        type: 'STATIC',
        key: 'foo/baz.txt',
      },
      {
        type: 'STATIC',
        key: 'foo/bar/boo.txt',
      },
    ], {
      wildcardAll: true,
    })

    const invalidations = await test('majority')
    expect(invalidations).to.have.length(1)
    expect(invalidations[0]).to.equal('/foo/bar/bang.txt*')
  })

  it('test root', async () => {
    const test = createInvalidationTest([
      {
        type: 'UPDATE',
        key: 'another-page',
      },
      {
        type: 'UPDATE',
        key: 'index.html',
      },
      {
        type: 'STATIC',
        key: 'another-page',
      },
      {
        type: 'STATIC',
        key: 'index.html',
      },
    ])

    const invalidations = await test('majority')
    expect(invalidations).to.have.length(1)
    expect(invalidations[0]).to.equal('/*')
  })
})