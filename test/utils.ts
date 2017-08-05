import * as faker from 'faker'
import * as minimatch from 'minimatch'
import {
  Item,
  Container,
  ContainerType,
  ListItemsOptions,
} from '../src/types'

export class MockItem implements Item {
  public key: string = faker.system.fileName('js', 'js')
  public modtime: Date = faker.date.past()
  public size: number = faker.random.number({ min: 64, max: 1024 })
  public isSymbolicLink: boolean = false

  constructor(item: Partial<Item> = {}) {
    Object.assign(this, item)
  }

  public read(): Promise<Buffer> {
    return Promise.resolve(new Buffer(this.size))
  }
}

const randomContainerType = (): ContainerType =>
  ['LOCAL' as ContainerType, 'S3' as ContainerType][Math.floor(Math.random() * 2)]

export class MockContainer implements Container {
  private items: Item[] = []

  public type: ContainerType = randomContainerType()

  constructor(container: Partial<Container> = {}) {
    Object.assign(this, container)
  }

  public setItems(items: Item[]) {
    this.items = items
  }

  public listItems(options: ListItemsOptions = {}): Promise<Item[]> {
    let items = this.items
    if (options.include) {
      items = items.filter(item => minimatch(item.key, options.include as string))
    }
    if (options.exclude) {
      items = items.filter(item => !minimatch(item.key, options.exclude as string))
    }

    return Promise.resolve(items)
  }

  public putItem(item: Item): Promise<Item> {
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].key === item.key) {
        this.items[i] = item
        return Promise.resolve(item)
      }
    }

    this.items.push(item)
    return Promise.resolve(item)
  }

  public delItem(item: Item): Promise<void> {
    for (let i = 0; i < this.items.length; i++) {
      if (this.items[i].key === item.key) {
        this.items.splice(i, 1)
      }
    }

    return Promise.resolve()
  }
}

export class MockSuite {
  public commonItems: Item[]
  public sourceItems: Item[]
  public targetItems: Item[]
  public sourceContainer: Container
  public targetContainer: Container

  constructor() {
    const commonItems = [
      new MockItem({ key: 'common_1' }),
      new MockItem({ key: 'common_2' }),
      new MockItem({ key: 'common_3' }),
    ]
    const sourceItems = [
      ...commonItems,
      // Updated
      new MockItem({
        key: 'update.html',
        modtime: new Date('8/5/2017'),
      }),
      // Created
      new MockItem({
        key: 'js/create.js',
      }),
    ]
    const targetItems = [
      ...commonItems,
      // for Updated index.html
      new MockItem({
        key: 'update.html',
        modtime: new Date('8/1/2017'),
      }),
      // Deleted
      new MockItem({
        key: 'i/am/deleted.css',
      }),
    ]
    const sourceContainer = new MockContainer({ type: 'LOCAL' })
    const targetContainer = new MockContainer({ type: 'S3' })

    sourceContainer.setItems(sourceItems)
    targetContainer.setItems(targetItems)

    this.commonItems = commonItems
    this.sourceItems = sourceItems
    this.targetItems = targetItems
    this.sourceContainer = sourceContainer
    this.targetContainer = targetContainer
  }
}

export function findItem(key: string, items: Item[]): Item | undefined {
  for (let i = 0; i < items.length; i++) {
    if (items[i].key === key) return items[i]
  }
}