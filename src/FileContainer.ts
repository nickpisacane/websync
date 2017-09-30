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

  private readAllFileNames(): Promise<string[]> {
    return new Promise((resolve, reject) => {
      glob(Path.join(this.baseDirectory, '**'), (err, fileNames) => {
        if (err) return reject(err)

        fileNames = fileNames
          .map(f => f.replace(this.baseDirectory, ''))
          .filter(f => !!f)

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
    const items: FileItem[] = []

    await Promise.all(
      fileNames.map(fileName => queue.add(async () => {
        const stat = await fs.stat(Path.join(this.baseDirectory, fileName))
        if (!stat.isDirectory()) {
          items.push(new FileItem(this.baseDirectory, fileName, stat))
        }
      }))
    )

    return items
  }

  public async putItem(item: Item): Promise<Item> {
    const body = await item.read()
    const fileName = Path.join(this.baseDirectory, item.key)
    const dirName = Path.dirname(fileName)

    await fs.mkdirp(dirName)
    await fs.writeFile(fileName, body)

    return FileItem.fromFileName(this.baseDirectory, item.key)
  }

  public async delItem(item: Item): Promise<void> {
    const fileName = Path.join(this.baseDirectory, item.key)
    await fs.unlink(fileName)
  }
}