import * as minimatch from 'minimatch'

export interface GlobMap <T> {
  [key: string]: T
}

export default class GlobTable <T> {
  private map: GlobMap<T>

  constructor(map: GlobMap<T>) {
    this.map = map
  }

  public lookup(key: string): T[] {
    const globs = Object.keys(this.map)
    const ret: T[] = []
    for (let i = 0; i < globs.length; i++) {
      if (minimatch(key, globs[i])) {
        ret.push(this.map[globs[i]])
      }
    }
    return ret
  }
}