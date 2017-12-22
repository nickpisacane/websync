import { expect } from 'chai'

import Transfer, { TransferItemCompleteEvent } from '../../src/Transfer'
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
    const itemCompletes: string[] = []

    transfer.on('itemComplete', (event: TransferItemCompleteEvent) => {
      itemCompletes.push(event.item.key)
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

    expect(
      diffs.every(diff => !!~itemCompletes.indexOf(diff.key))
    ).to.equal(true)
  })
})