import Item from './Item'

export interface ListItemsOptions {
  include?: string
  exclude?: string
}

export default interface Container {
  listItems(options?: ListItemsOptions): Promise<Item[]>
}