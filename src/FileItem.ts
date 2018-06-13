import * as Path from 'path'
import * as fs from 'fs-extra'
import { Item, Container } from './types'
import * as crypto from 'crypto'

export default class FileItem implements Item {
  private baseDirectory: string
  private computedEtag?: string

  public key: string
  public modtime: Date
  public size: number
  public isSymbolicLink: boolean

  constructor(baseDirectory: string, fileName: string, stats: fs.Stats) {
    // remove leading slash
    fileName = fileName.replace(/^\//, '')

    this.baseDirectory = baseDirectory
    this.key = fileName
    this.modtime = stats.mtime
    this.size = stats.size
    this.isSymbolicLink = stats.isSymbolicLink()
  }

  public etag(): string {
    if (this.computedEtag === undefined) {
      this.computedEtag = FileItem.computeEtag(Path.join(this.baseDirectory, this.key))
    }
    return this.computedEtag!
  }

  private static computeEtag(filepath: string): string {
    const hash = crypto.createHash('md5')
    const buffer = Buffer.alloc(8192)

    const fd = fs.openSync(filepath, 'r')
    try {
      let bytesRead
      do {
        bytesRead = fs.readSync(fd, buffer, 0, 8192, null)
        hash.update(buffer.slice(0, bytesRead))
      } while (bytesRead === 8192)
    } finally {
      fs.closeSync(fd)
    }
    return `"${hash.digest('hex')}"`
  }

  read(): Promise<Buffer> {
    return fs.readFile(Path.join(this.baseDirectory, this.key))
  }

  public static async fromFileName(baseDirectory: string, fileName: string): Promise<FileItem> {
    const stats = await fs.stat(Path.join(baseDirectory, fileName))

    return new FileItem(baseDirectory, fileName, stats)
  }
}