import { Container, Item, ItemDiffType, ItemDiff, FilterOptions } from './types'

export type DiffKey = 'modtime' | 'size'

const getItem = (items: Item[], key: string): Item | undefined => {
  for (let i = 0; i < items.length; i++) {
    if (items[i].key === key) return items[i]
  }
}

const shouldUpdate = (source: Item, target: Item, diffKey: DiffKey): boolean => {
  switch (diffKey) {
    case 'modtime':
      return source.modtime.getTime() > target.modtime.getTime()
    case 'size':
      return source.size !== target.size
  }
}

export default async function diff(
  source: Container,
  target: Container,
  diffKey: DiffKey = 'modtime',
  filterOptions?: FilterOptions
): Promise<ItemDiff[]> {
  const sourceItems = await source.listItems(filterOptions)
  const targetItems = await target.listItems()
  const diffs: ItemDiff[] = []

  sourceItems.forEach(source => {
    const target = getItem(targetItems, source.key)
    if (!target) {
      diffs.push({
        type: 'CREATE',
        key: source.key,
        source,
      })
    } else if (shouldUpdate(source, target, diffKey)) {
      diffs.push({
        type: 'UPDATE',
        key: source.key,
        source,
        target,
      })
    }
  })

  targetItems.forEach(target => {
    const source = getItem(sourceItems, target.key)
    if (!source) {
      diffs.push({
        type: 'DELETE',
        key: target.key,
        target,
      })
    }
  })

  return diffs
}