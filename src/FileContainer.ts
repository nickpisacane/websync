import * as Path from 'path'
import * as fs from 'fs-extra'
import * as glob from 'glob'
import * as minimatch from 'minimatch'
import * as PQueue from 'p-queue'
import { Container, ContainerType, ListItemsOptions, Item } from './types'
import FileItem from './FileItem'

export default class FileContainer implements Container {
  private baseDirectory: string

  public type: ContainerType = 'S3'

  constructor(baseDirectory: string) {
    this.baseDirectory = baseDirectory
  }

  private readAllFileNames(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      glob(Path.join(this.baseDirectory, '**'), (err, fileNames) => {
        if (err) return reject(err)
        resolve(fileNames)
      })
    })
  }

  public async listItems(options: ListItemsOptions = {}): Promise<Item[]> {
    let fileNames = await this.readAllFileNames()
    if (options.include) {
      fileNames = fileNames.filter((fileName) => minimatch(fileName, options.include as string))
    }
    if (options.exclude) {
      fileNames = fileNames.filter(fileName => !minimatch(fileName, options.exclude as string))
    }

    const queue = new PQueue({ concurrency: 10 })
    const items = await Promise.all<Item>(
      fileNames.map(fileName => queue.add(() => FileItem.fromFileName(fileName, this)))
    )
    return items
  }

  public async putItem(item: Item): Promise<Item> {
    const body = await item.read()
    const fileName = Path.join(this.baseDirectory, item.key)
    await fs.writeFile(fileName, body)
    return FileItem.fromFileName(fileName, this)
  }

  public async delItem(item: Item): Promise<void> {
    const fileName = Path.join(this.baseDirectory, item.key)
    await fs.unlink(fileName)
  }
}