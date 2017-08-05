import * as faker from 'faker'
import {
  Item,
} from '../src/types'

class MockItem implements Item {
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