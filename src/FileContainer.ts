import * as Path from 'path'
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
      fileNames.map(fileName => queue.add(() => FileItem.fromFileName(fileName)))
    )
    return items
  }
}