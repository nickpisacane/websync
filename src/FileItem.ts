import * as fs from 'fs-extra'
import Item from './Item'

export default class FileItem implements Item {
  public key: string
  public modtime: Date
  public size: number
  public isSymbolicLink: boolean

  constructor(fileName: string, stats: fs.Stats) {
    this.key = fileName
    this.modtime = stats.mtime
    this.size = stats.size
    this.isSymbolicLink = stats.isSymbolicLink()
  }

  read(): Promise<Buffer> {
    return fs.readFile(this.key)
  }

  del(): Promise<boolean> {
    return fs.unlink(this.key).then(() => true)
  }

  public static async fromFileName(fileName: string): Promise<FileItem> {
    const stats = await fs.stat(fileName)
    return new FileItem(fileName, stats)
  }
}