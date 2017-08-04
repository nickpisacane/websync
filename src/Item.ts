export default interface Item {
  key: string
  modtime: Date
  size: number
  isSymbolicLink: boolean

  read(): Promise<Buffer>
  del(): Promise<boolean>
}

export enum DiffType {
  CREATE,
  UPDATE,
  DELETE
}

export interface Diff {
  type: DiffType
  key: string
  source: Item | null
  target: Item | null
}