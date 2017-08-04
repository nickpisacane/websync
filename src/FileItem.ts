import * as fs from 'fs-extra'
import { Item, Container } from './types'

export default class FileItem implements Item {
  public key: string
  public modtime: Date
  public size: number
  public isSymbolicLink: boolean
  public container: Container

  constructor(fileName: string, stats: fs.Stats, container: Container) {
    this.key = fileName
    this.modtime = stats.mtime
    this.size = stats.size
    this.isSymbolicLink = stats.isSymbolicLink()
    this.container = container
  }

  read(): Promise<Buffer> {
    return fs.readFile(this.key)
  }

  public static async fromFileName(fileName: string, container: Container): Promise<FileItem> {
    const stats = await fs.stat(fileName)
    return new FileItem(fileName, stats, container)
  }
}