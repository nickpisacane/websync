import * as minimatch from 'minimatch'

export interface GlobMap <T> {
  [key: string]: T
}

export default class GlobTable <T> {
  private map: GlobMap<T>

  constructor(map: GlobMap<T>) {
    this.map = map
  }

  public lookup(key: string): T | undefined {
    const globs = Object.keys(this.map)
    for (let i = 0; i < globs.length; i++) {
      if (minimatch(key, globs[i])) {
        return this.map[globs[i]]
      }
    }
  }
}