import { expect } from 'chai'
import * as Path from 'path'
import Config from '../../src/Config'

describe('Config', () => {
  it('parses config from args', async () => {
    const config = new Config({
      argv: ['foo', 's3://test', '--diffBy', 'modtime'],
    })

    const options = await config.resolve()
    expect(options.source).to.equal('foo')
    expect(options.target).to.equal('s3://test')
    expect(options.diffBy).to.equal('modtime')
  })

  it('throws an error if `source` or `target` are not provided', async () => {
    const config = new Config({
      argv: ['--diffBy', 'size'],
    })
    try {
      const options = await config.resolve()
      throw new Error('FAILED')
    } catch (err) {
      expect(err.message).to.not.equal('FAILED')
    }
  })

  it('parses config from json file', async () => {
    const config = new Config({
      argv: ['foo', 's3://test'],
      configFileName: Path.join(__dirname, '../fixtures/websync.config.json'),
    })
    const options = await config.resolve()
    expect(options.diffBy).to.equal('modtime')
    expect(options.invalidateDeletes).to.equal(false)
    expect(options.include).to.equal('foo/**/*')
    expect(options.exclude).to.equal('bar/**/*.bang')
  })

  it('argv options override config file', async () => {
    const config = new Config({
      argv: ['foo', 's3://test', '--include', 'baz/*'],
      configFileName: Path.join(__dirname, '../fixtures/websync.config.json'),
    })
    const options = await config.resolve()
    expect(options.include).to.equal('baz/*')
  })

  it('`source` and `target` are optional from argv, if provided in config', async () => {
    const config = new Config({
      configFileName: Path.join(__dirname, '../fixtures/websync.config.js'),
    })
    const options = await config.resolve()
    expect(options.source).to.equal('./foo')
    expect(options.target).to.equal('s3://nope')
    expect(options.diffBy).to.equal('modtime')
    expect(options.invalidateDeletes).to.equal(false)
  })
})