export interface FilterOptions {
  include?: string // glob pattern
  exclude?: string // glob pattern
}

export interface Item {
  key: string
  modtime: Date
  size: number
  isSymbolicLink: boolean

  read(): Promise<Buffer>
  del(): Promise<boolean>
}

export type ContainerType = 'LOCAL' | 'S3'

export interface ListItemsOptions extends FilterOptions {
}

export interface Container {
  type: ContainerType
  listItems(options?: ListItemsOptions): Promise<Item[]>
}

export type ItemDiffType = 'UPDATE' | 'CREATE' | 'DELETE'

export interface ItemDiff {
  type: ItemDiffType
  key: string
  source: Item | null
  target: Item | null
}