import { S3 } from 'aws-sdk'

export type S3PutModifier = Partial<S3.PutObjectRequest>
export type S3DeleteModifier = Partial<S3.DeleteObjectRequest>

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
  s3Options?: S3PutModifier
}

export interface DelItemOptions {
  s3Options?: S3DeleteModifier 
}


export interface Container {
  type: ContainerType
  listItems(options?: ListItemsOptions): Promise<Item[]>
  putItem(item: Item, options?: PutItemOptions): Promise<Item>
  delItem(item: Item, options?: DelItemOptions): Promise<void>
}

export type ItemDiffType = 'UPDATE' | 'CREATE' | 'DELETE'

export type ItemDiffUpdate = {
  type: 'UPDATE'
  key: string
  source: Item
  target: Item
}

export type ItemDiffCreate = {
  type: 'CREATE'
  key: string 
  source: Item
}

export type ItemDiffDelete = {
  type: 'DELETE'
  key: string
  target: Item
}

export type ItemDiff = ItemDiffUpdate | ItemDiffCreate | ItemDiffDelete