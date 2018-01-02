import { expect } from 'chai'

import GlobTable from '../../src/GlobTable'

describe('GlobTable', () => {
  it('basic lookup', () => {
    const table = new GlobTable<string>({
      './foo/**/*.js': 'bar',
    })

    expect(table.lookup('./foo/bar/bang.js')).to.deep.equal(['bar'])
  })
})