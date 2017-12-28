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

const expectInvalidations = (result: string[], expected: string[]) => {
  expect(result.slice().sort()).to.deep.equal(expected.slice().sort())
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
        if (!(kd.key in sizes) && !(kd.key in modtimes)) {
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

  // TODO: Explain test cases...
  const test1 = createInvalidationTest([
    {
      type: 'UPDATE',
      key: 'foo',
    },
    {
      type: 'UPDATE',
      key: 'bar',
    },
    {
      type: 'STATIC',
      key: 'bang',
    },
  ])

  const test2 = createInvalidationTest([
    {
      type: 'UPDATE',
      key: 'foo/bar',
    },
    {
      type: 'STATIC',
      key: 'foo/bang',
    },
    {
      type: 'STATIC',
      key: 'foo/baz',
    },
    {
      type: 'UPDATE',
      key: 'boo',
    },
  ])

  const test3 = createInvalidationTest([
    {
      type: 'UPDATE',
      key: 'foo/bar',
    },
    {
      type: 'UPDATE',
      key: 'foo/bang',
    },
    {
      type: 'STATIC',
      key: 'foo/baz',
    },
  ])

  const test4 = createInvalidationTest([
    {
      type: 'UPDATE',
      key: 'foo/bar',
    },
    {
      type: 'UPDATE',
      key: 'foo/bang',
    },
    {
      type: 'STATIC',
      key: 'foo/baz',
    },
    {
      type: 'UPDATE',
      key: 'boo',
    },
    {
      type: 'STATIC',
      key: 'booz',
    },
    {
      type: 'STATIC',
      key: 'banger',
    },
  ])

  const test5 = createInvalidationTest([
    {
      type: 'UPDATE',
      key: 'foo/bar',
    },
    {
      type: 'STATIC',
      key: 'foo/bang',
    },
    {
      type: 'UPDATE',
      key: 'foo/baz/bar',
    },
    {
      type: 'UPDATE',
      key: 'foo/baz/boo',
    },
    {
      type: 'STATIC',
      key: 'one',
    },
    {
      type: 'STATIC',
      key: 'two',
    },
    {
      type: 'STATIC',
      key: 'three',
    },
  ])

  // TEST 1
  it('test 1 (majority)', async () => {
    const invalidations = await test1('majority')
    expect(invalidations).to.have.length(1)
    expect(invalidations[0]).to.equal('/*')
  })
  it('test 1 (minority)', async () => {
    const invalidations = await test1('minority')
    expect(invalidations).to.have.length(1)
    expect(invalidations[0]).to.equal('/*')
  })
  it('test 1 (unanimous)', async () => {
    const invalidations = await test1('unanimous')
    expect(invalidations).to.have.length(2)
    expectInvalidations(invalidations, ['/foo', '/bar'])
  })

  // TEST 2
  it('test 2 (majority)', async () => {
    const invalidations = await test2('majority')
    expect(invalidations).to.have.length(2)
    expectInvalidations(invalidations, ['/foo/bar', '/boo'])
  })
  it('test 2 (minority)', async () => {
    const invalidations = await test2('minority')
    expect(invalidations).to.have.length(1)
    expect(invalidations[0]).to.equal('/*')
  })
  it('test 2 (unanimous)', async () => {
    const invalidations = await test2('unanimous')
    expect(invalidations).to.have.length(2)
    expectInvalidations(invalidations, ['/foo/bar', '/boo'])
  })

  // TEST 3
  it('test 3 (majority)', async () => {
    const invalidations = await test3('majority')
    expect(invalidations).to.have.length(1)
    expect(invalidations[0]).to.equal('/*')
  })
  it('test 3 (minority)', async () => {
    const invalidations = await test3('minority')
    expect(invalidations).to.have.length(1)
    expect(invalidations[0]).to.equal('/*')
  })
  it('test 3 (unanimous)', async () => {
    const invalidations = await test3('unanimous')
    expect(invalidations).to.have.length(2)
    expectInvalidations(invalidations, ['/foo/bar', '/foo/bang'])
  })

  // TEST 4
  it('test 4 (majority)', async () => {
    const invalidations = await test4('majority')
    expect(invalidations).to.have.length(2)
    expectInvalidations(invalidations, ['/foo/*', '/boo'])
  })
  it('test 4 (minority)', async () => {
    const invalidations = await test4('minority')
    expect(invalidations).to.have.length(1)
    expect(invalidations[0]).to.equal('/*')
  })
  it('test 4 (unanimous)', async () => {
    const invalidations = await test4('unanimous')
    expect(invalidations).to.have.length(3)
    expectInvalidations(invalidations, ['/foo/bar', '/foo/bang', '/boo'])
  })

  // TEST 5
  it('test 5 (majority)', async () => {
    const invalidations = await test5('majority')
    expect(invalidations).to.have.length(1)
    expectInvalidations(invalidations, ['/foo*'])
  })
  it('test 5 (minority)', async () => {
    const invalidations = await test5('minority')
    expect(invalidations).to.have.length(1)
    expect(invalidations[0]).to.equal('/*')
  })
  it('test 5 (unanimous)', async () => {
    const invalidations = await test5('unanimous')
    expect(invalidations).to.have.length(2)
    expectInvalidations(invalidations, ['/foo/bar', '/foo/baz/*'])
  })


  // Basic wildcard-all test
  it('appends wildcard when `wildcardAll` option is true', async () => {
    const test = createInvalidationTest([
      {
        type: 'UPDATE',
        key: 'foo',
      },
      {
        type: 'STATIC',
        key: 'bar',
      },
    ], {
      wildcardAll: true,
    })

    const majority = await test('majority')
    expectInvalidations(majority, ['/foo*'])

    const minority = await test('minority')
    expectInvalidations(minority, ['/*'])

    const unanimous = await test('unanimous')
    expectInvalidations(unanimous, ['/foo*'])
  })
})