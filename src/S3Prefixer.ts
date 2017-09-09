import * as path from 'path'

export default class S3Prefixer {
  private replaceReg: RegExp
  public readonly prefix: string

  constructor(prefix: string = '') {
    this.prefix = prefix.replace(/^\//, '')
    this.replaceReg = new RegExp(`^${this.prefix}/?`)
  }

  public withPrefix(key: string): string {
    return path.join(this.prefix, key)
  }

  public withoutPrefix(key: string): string {
    return key.replace(this.replaceReg, '')
  }
}