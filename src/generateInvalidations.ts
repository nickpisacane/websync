import * as Path from 'path'
import {
  Item,
  ItemDiff,
  ItemDiffType,
  Invalidation,
} from './types'
import PathTree from './PathTree'

// @see: http://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html#invalidation-specifying-objects
export const match = (path: string, pattern: string): boolean => {
  path = normalizeInvalidationPath(path, false)
  pattern = normalizeInvalidationPath(pattern, false)
  let re: RegExp

  if (/\/\*$/.test(pattern)) {
    // Cases:
    // 1. /foo/.../bar/* -> matches any object directly within `/foo/.../bar`
    // 2. /* -> matches all objects in distribution
    re = pattern === '/*'
      ? /.*/
      : new RegExp(`^${pattern.replace(/\/\*$/, '\/[^/]*')}$`)
  } else if (/\*$/.test(pattern)) {
    // /foo/bar* -> matches any object in `/foo/bar` and subdirectories if `bar` is a directory.
    // Otherwise, matches any files with in `/foo` that start with `bar`
    re = new RegExp(`^${pattern.replace(/\*$/, '.*')}$`)
  } else {
    // strict equality
    return path === pattern
  }

  return re.test(path)
}

export const normalizeInvalidationPath = (path: string, wildcard: boolean = false): string => {
  if (!/^\//.test(path)) path = `/${path}`
  if (!/\*$/.test(path) && wildcard) path = `${path}*`
  return path
}

export const isInvalidated = (path: string, invalidations: string[]) =>
  invalidations.some(invalidation => match(normalizeInvalidationPath(path, false), invalidation))

export type WildcardPolicy = 'majority' | 'all'

export interface GenerateInvalidationsOptions {
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

  const itemTree = new PathTree(targetItems.map(item => item.key))
  const diffTree = new PathTree(diffs.map(d => d.key))
  const invalidationPaths: string[] = []

  diffTree.walk('/', node => {
    if (isInvalidated(node.path, invalidationPaths)) return

    let invalidationPath: string
    if (!node.children.length) {
      invalidationPath = node.path
    }

    const itemNode = itemTree.lookup(node.path)
    if (!itemNode) {
      throw new Error(`Expected item tree to have node: "${node.path}"`)
    }

    const shouldWildCard = wildcardPolicy === 'majority'
      ? node.children.length / itemNode.children.length > 0.5
      : node.children.length === itemNode.children.length

    if (shouldWildCard) {
      invalidationPath = Path.join(node.path, '*')
    } else {
      invalidationPath = node.path
    }
  })

  return []
}