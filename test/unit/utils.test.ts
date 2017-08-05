import { expect } from 'chai'

import {
  MockItem,
  MockContainer,
  MockSuite,
  findItem,
} from '../utils'

describe('utils', () => {
  describe('MockItem', () => {
    it('basic', async () => {
      const item = new MockItem()
      expect(item.key.length > 0).to.equal(true)
      expect(item.isSymbolicLink).to.equal(false)
      expect(item.modtime).to.be.instanceof(Date)
      expect(item.modtime.getTime() < Date.now()).to.equal(true)
      expect(item.size >= 64 && item.size <= 1024).to.equal(true)

      const body = await item.read()
      expect(body.length).to.equal(item.size)
    })
  })

  describe('MockContainer', () => {
    const items = [
      new MockItem({ key: 'foo' }),
      new MockItem({ key: 'bar' }),
      new MockItem({ key: 'bang' }),
    ]
    const container = new MockContainer()
    container.setItems(items)

    it('lists items', async () => {
      expect((await container.listItems()).map(i => i.key))
      .to.deep.equal(['foo', 'bar', 'bang'])
    })

    it('puts items (create)', async () => {
      await container.putItem(new MockItem({ key: 'baz' }))
      expect((await container.listItems()).map(i => i.key))
        .to.deep.equal(['foo', 'bar', 'bang', 'baz'])
    })

    it('deletes items', async () => {
       await container.delItem(items[1])
      expect((await container.listItems()).map(i => i.key))
        .to.deep.equal(['foo', 'bang', 'baz'])
    })

    it('puts items (update)', async () => {
      const newBazDate = new Date()
      const newBaz = new MockItem({
        key: 'baz',
        modtime: newBazDate,
      })
      await container.putItem(newBaz)
      expect((await container.listItems()).map(i => i.key))
        .to.deep.equal(['foo', 'bang', 'baz'])
      const [ foo, bang, baz ] = await container.listItems()
      expect(baz.modtime.getTime()).to.equal(newBazDate.getTime())
    })
  })

  describe('MockSuite', () => {
    const suite = new MockSuite()

    it('sourceContainer has 5 items', async () => {
      const sourceItems = await suite.sourceContainer.listItems()
      expect(sourceItems).to.have.length(5)
    })

    it('targetContainer has 5 items', async () => {
      const targetItems = await suite.targetContainer.listItems()
      expect(targetItems).to.have.length(5)
    })

    it('sourceContainer has a new "update.html"', async () => {
      const sourceItems = await suite.sourceContainer.listItems()
      const targetItems = await suite.targetContainer.listItems()
      const sourceUpdate = sourceItems[3]
      const targetUpdate = targetItems[3]

      expect(sourceUpdate.key).to.equal('update.html')
      expect(targetUpdate.key).to.equal('update.html')

      expect(sourceUpdate.modtime.getTime() > targetUpdate.modtime.getTime())
        .to.equal(true)
    })

    it('sourceContainer contains "js/create.js" but targetContainer does not', async () => {
      const sourceItems = await suite.sourceContainer.listItems()
      const targetItems = await suite.targetContainer.listItems()
      expect(sourceItems.some(i => i.key === 'js/create.js')).to.equal(true)
      expect(targetItems.every(i => i.key !== 'js/create.js')).to.equal(true)
    })

    it('targetContainer contains "i/am/deleted.css" but sourceContainer does not', async () => {
      const sourceItems = await suite.sourceContainer.listItems()
      const targetItems = await suite.targetContainer.listItems()
      expect(targetItems.some(i => i.key === 'i/am/deleted.css')).to.equal(true)
      expect(sourceItems.every(i => i.key !== 'i/am/deleted.css')).to.equal(true)
    })
  })

  it('findItem', async () => {
    const suite = new MockSuite()
    const sourceItems = await suite.sourceContainer.listItems()

    const updateHTML = findItem('update.html', sourceItems)
    expect(updateHTML).to.equal(sourceItems[3])

    const nope = findItem('nope.txt', sourceItems)
    expect(nope).to.equal(undefined)
  })
})