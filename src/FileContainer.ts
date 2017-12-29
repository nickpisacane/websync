import * as Path from 'path'
import * as fs from 'fs-extra'
import * as glob from 'glob'
import * as minimatch from 'minimatch'
import * as PQueue from 'p-queue'
import { Container, ContainerType, ListItemsOptions, Item } from './types'
import FileItem from './FileItem'

export default class FileContainer implements Container {
  private baseDirectory: string
  public type: ContainerType = 'FILE'

  constructor(baseDirectory: string) {
    this.baseDirectory = baseDirectory
  }

  private getDir(): string {
    return Path.resolve(this.baseDirectory)
  }

  private readAllFileNames(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      glob(Path.join(this.getDir(), '**'), (err, fileNames) => {
        if (err) return reject(err)

        fileNames = fileNames
          .map(f => f.replace(this.getDir(), ''))
          .filter(f => !!f)

        resolve(fileNames)
      })
    })
  }

  public async listItems(options: ListItemsOptions = {}): Promise<Item[]> {
    let fileNames = await this.readAllFileNames()
    const { include, exclude } = options
    if (include) {
      fileNames = fileNames.filter((fileName) => minimatch(fileName, include, { matchBase: true }))
    }
    if (exclude) {
      fileNames = fileNames.filter((fileName) => !minimatch(fileName, exclude, { matchBase: true }))
    }

    const queue = new PQueue({ concurrency: 10 })
    const items: FileItem[] = []

    await Promise.all(
      fileNames.map(fileName => queue.add(async () => {
        const stat = await fs.stat(Path.join(this.getDir(), fileName))
        if (!stat.isDirectory()) {
          items.push(new FileItem(this.getDir(), fileName, stat))
        }
      }))
    )

    return items
  }

  public async putItem(item: Item): Promise<Item> {
    const body = await item.read()
    const fileName = Path.join(this.getDir(), item.key)
    const dirName = Path.dirname(fileName)

    await fs.mkdirp(dirName)
    await fs.writeFile(fileName, body)

    return FileItem.fromFileName(this.getDir(), item.key)
  }

  public async delItem(item: Item): Promise<void> {
    const fileName = Path.join(this.getDir(), item.key)
    await fs.unlink(fileName)
  }
}