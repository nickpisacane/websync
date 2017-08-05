import {
  Item,
  ItemDiff,
  ItemDiffType,  
  Invalidation,
} from './types'

type WildcardPolicy = 'majority' | 'all'

interface GenerateInvalidationsOptions {
  diffs: ItemDiff[]
  targetItems: Item[]
  wildcardPolicy: WildcardPolicy
  wildcardSuffix: boolean
  trailingSlash: boolean
  invalidateDeletes: boolean
}

export default function generateInvalidations({
  diffs,
  targetItems,
  wildcardPolicy = 'majority',
  wildcardSuffix = false,
  trailingSlash = false,
  invalidateDeletes = true,
}: GenerateInvalidationsOptions): Invalidation[] {
  const filterDiffTypes: ItemDiffType[] = ['CREATE']
  if (!invalidateDeletes) filterDiffTypes.push('DELETE')
   
  diffs = diffs.filter(diff => !~filterDiffTypes.indexOf(diff.type))

  // TODO: Create two trees -- one for `targetItems` (represents target container)
  // and another for `diffs`. Walk the diff tree, at each node compare the children
  // count to the children count of the `targetItem` tree, use `wildcardPolicy` to 
  // determine whether, or not, a given wildcard can be generated for a given
  // `diff` tree Node.
}