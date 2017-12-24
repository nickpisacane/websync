import * as fs from 'fs-extra'
import * as Path from 'path'
import * as minimist from 'minimist'
import { WebsyncOptions } from './Websync'

const defaultConfigNames: string[] = [
  'websync.js',
  'websync.json',
]

export interface ConfigFile extends WebsyncOptions {
  region?: string
}

export interface ConfigOptions {
  argv?: string[]
  configFileName?: string
}

export default class Config {
  private argv: string[]
  private configFileName: string

  constructor({ argv = [], configFileName = '' }: ConfigOptions) {
    this.argv = argv
    this.configFileName = configFileName
  }

  private async getDefaultConfigFileName(): Promise<string> {
    for (let i = 0; i < defaultConfigNames.length; i++) {
      try {
        const stat = await fs.stat(defaultConfigNames[i])
        if (stat.isFile()) return defaultConfigNames[i]
      } catch (err) {}
    }
    return ''
  }

  private async readConfigFile(): Promise<Partial<ConfigFile>> {
    if (!this.configFileName) {
      this.configFileName = await this.getDefaultConfigFileName()
    }
    if (!this.configFileName) {
      return {}
    }
    console.log('requiring: ', this.configFileName)
    const opts = require(Path.resolve(this.configFileName)) as Partial<ConfigFile>
    return opts
  }

  public async resolve(): Promise<ConfigFile> {
    const args = minimist(this.argv)
    const opts: Partial<ConfigFile> = await this.readConfigFile()
    console.log('OPTS: ', opts)
    console.log('ARGS: ', args)
    if (args._.length) {
      if (args._.length !== 2) {
        throw new Error('Config: `source` and `target` are both required, if supplied by argv.')
      }
      const [ source, target ] = args._
      opts.source = source
      opts.target = target
    }
    if (args.include) {
      opts.include = args.include
    }
    if (args.exclude) {
      opts.exclude = args.exclude
    }
    if (args.diffBy) {
      opts.diffBy = args.diffBy
    }
    if (args.wildcardPolicy) {
      opts.wildcardPolicy = args.wildcardPolicy
    }
    if ('wildcardAll' in args) {
      opts.wildcardAll = Boolean(opts.wildcardAll)
    }
    if ('invalidateDeletes' in args) {
      opts.invalidateDeletes = args.invalidateDeletes
    }
    if (typeof opts.source !== 'string' || typeof opts.target !== 'string') {
      throw new Error('Config: `source` and `target` options are required')
    }
    console.log('OPTS 2: ', opts)
    return opts as ConfigFile
  }
}