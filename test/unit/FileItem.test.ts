import * as Path from 'path'
import * as fs from 'fs-extra'
import { expect } from 'chai'

import FileItem from '../../src/FileItem'

describe('FileItem', async () => {
  const directory = Path.normalize(Path.join(__dirname, '../fixtures/testDirectory'))
  const fileItem = await FileItem.fromFileName(directory, '/bar.txt')

  it('propreties', async () => {
    const stat = await fs.stat(Path.join(directory, 'bar.txt'))
    expect(stat.mtime.getTime()).to.equal(fileItem.modtime.getTime())
    expect(fileItem.size).to.equal(stat.size)
    expect(fileItem.isSymbolicLink).to.equal(false)
    expect(fileItem.key).to.equal('bar.txt')
  })

  it('read()', async () => {
    const body = await fileItem.read()
    expect(body.toString()).to.equal('bang')
  })
})