import { expect } from 'chai'

import Transfer from '../../src/Transfer'
import diff from '../../src/diff'
import {
  MockSuite,
  findItem,
} from '../utils'

describe('Transfer', () => {
  it('should apply diffs to target container', async () => {
    const suite = new MockSuite()
    const diffs = await diff(suite.sourceContainer, suite.targetContainer)
    const transfer = new Transfer({
      source: suite.sourceContainer,
      target: suite.targetContainer,
      diffs,
    })

    await transfer.complete()

    const targetItems = await suite.targetContainer.listItems()
    const sourceItems = await suite.sourceContainer.listItems()
    const totalKeys = sourceItems.map(i => i.key)

    expect(
      targetItems.every(item => !!~totalKeys.indexOf(item.key))
    ).to.equal(true)

    expect(
      sourceItems.every(sourceItem => {
        const targetItem = findItem(sourceItem.key, targetItems)
        return !!sourceItem && !!targetItem && sourceItem.modtime === targetItem.modtime
      })
    ).to.equal(true)
  })
})