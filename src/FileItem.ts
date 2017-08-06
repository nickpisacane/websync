import * as Path from 'path'
import * as fs from 'fs-extra'
import { Item, Container } from './types'

export default class FileItem implements Item {
  private baseDirectory: string

  public key: string
  public modtime: Date
  public size: number
  public isSymbolicLink: boolean

  constructor(baseDirectory: string, fileName: string, stats: fs.Stats) {
    this.baseDirectory = baseDirectory
    this.key = fileName
    this.modtime = stats.mtime
    this.size = stats.size
    this.isSymbolicLink = stats.isSymbolicLink()
  }

  read(): Promise<Buffer> {
    return fs.readFile(Path.join(this.baseDirectory, this.key))
  }

  public static async fromFileName(baseDirectory: string, fileName: string): Promise<FileItem> {
    const stats = await fs.stat(Path.join(baseDirectory, fileName))
    fileName = fileName.replace(/^\//, '')

    return new FileItem(baseDirectory, fileName, stats)
  }
}