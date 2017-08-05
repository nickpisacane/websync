import { expect } from 'chai'

import diff from '../../src/diff'
import {
  MockSuite,
} from '../utils'

describe('diff', () => {
  it('should should diff two containers', async () => {
    const suite = new MockSuite()
    const diffs = await diff(suite.sourceContainer, suite.targetContainer)
    const [ updateDiff, createDiff, deleteDiff ] = diffs

    expect(updateDiff.type).to.equal('UPDATE')
    expect(updateDiff.key).to.equal('update.html')

    expect(createDiff.type).to.equal('CREATE')
    expect(createDiff.key).to.equal('js/create.js')

    expect(deleteDiff.type).to.equal('DELETE')
    expect(deleteDiff.key).to.equal('i/am/deleted.css')
  })
})