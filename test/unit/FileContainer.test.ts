import * as Path from 'path'
import * as fs from 'fs-extra'
import { expect } from 'chai'

import { Item } from '../../src/types'
import FileContainer from '../../src/FileContainer'

describe('FileContainer', () => {
  const directory = Path.normalize(Path.join(__dirname, '../fixtures/testDirectory'))
  const fileContainer = new FileContainer(directory)

  it('listItems only lists files', async () => {
    const fileItems = await fileContainer.listItems()
    const expectedKeys = [
      '/bang/baz.txt',
      '/bar.txt',
      '/foo.txt',
    ]
    const actualKeys = fileItems.map(i => i.key)

    expect(
      expectedKeys.every(key => !!~actualKeys.indexOf(key))
    ).to.equal(true)
  })

  it('putItem()', async () => {
    const body = new Buffer('Hello world')
    const item: Item = {
      key: '/bang/a/b/d.txt',
      modtime: new Date(),
      size: body.length,
      isSymbolicLink: false,
      read: () => Promise.resolve(body),
    }

    await fileContainer.putItem(item)

    const fromFS = await fs.readFile(Path.join(directory, item.key), 'utf8')
    expect(fromFS).to.equal('Hello world')

    await fs.remove(Path.join(directory, '/bang/a'))
  })

  it('delItem()', async () => {
    const body = new Buffer('Hello world')
    const item: Item = {
      key: '/bang/a/b/d.txt',
      modtime: new Date(),
      size: body.length,
      isSymbolicLink: false,
      read: () => Promise.resolve(body),
    }

    await fileContainer.putItem(item)

    expect(await fs.pathExists(Path.join(directory, item.key))).to.equal(true)

    await fileContainer.delItem(item)

    expect(await fs.pathExists(Path.join(directory, item.key))).to.equal(false)
    // clean up
    await fs.remove(Path.join(directory, 'bang/a'))
  })
})