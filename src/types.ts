import { S3 } from 'aws-sdk'

export interface FilterOptions {
  include?: string // glob pattern
  exclude?: string // glob pattern
}

export interface Item {
  key: string
  modtime: Date
  size: number
  isSymbolicLink: boolean
  container: Container
  read(): Promise<Buffer>
}

export type ContainerType = 'LOCAL' | 'S3'

export interface ListItemsOptions extends FilterOptions {
}

export interface PutItemOptions {
  s3Options?: S3.PutObjectRequest
}

export interface DelItemOptions {
  s3Options?: S3.DeleteObjectRequest 
}


export interface Container {
  type: ContainerType
  listItems(options?: ListItemsOptions): Promise<Item[]>
  putItem(item: Item, options?: PutItemOptions): Promise<Item>
  delItem(item: Item, options?: DelItemOptions): Promise<void>
}

export type ItemDiffType = 'UPDATE' | 'CREATE' | 'DELETE'

export interface ItemDiff {
  type: ItemDiffType
  key: string
  source?: Item
  target?: Item
}