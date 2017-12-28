const splitPath = (path: string): string[] => path.split('/').filter(s => !!s)
const joinPaths = (paths: string[], count: number = -1): string =>
  paths.slice(0, count < 0 ? paths.length : count).join('/')

export class Node {
  public name: string
  public path: string
  public children: Node[] = []
  public parent: Node | null = null

  constructor(name: string, path: string, parent?: Node) {
    this.name = name
    this.path = path
    if (parent) {
      this.parent = parent
    }
  }

  toJSON(): Partial<Node> {
    return {
      name: this.name,
      path: this.path,
      children: this.children,
    }
  }
}

export type WalkFn = (node: Node) => void

export default class PathTree {
  private root: Node

  constructor(paths?: string[]) {
    this.root = new Node('%ROOT%', '/')
    if (paths) {
      paths.forEach(path => this.add(path))
    }
  }

  public add(path: string): Node {
    const paths = splitPath(path)
    let context = this.root

    paths.forEach((path, i) => {
      let node = this.lookup(paths[i], context)
      if (!node) {
        node = new Node(paths[i], joinPaths(paths, i + 1), context)
        context.children.push(node)
      }

      context = node
    })

    return context
  }

  public lookup(path: string, context: Node = this.root): Node | null {
    const paths = splitPath(path)

    for (let i = 0; i < paths.length; i++) {
      const prevContext: Node = context

      for (let j = 0; j < context.children.length; j++) {
        if (paths[i] === context.children[j].name) {
          context = context.children[j]
          break
        }
      }

      // No node was found
      if (context === prevContext) {
        return null
      }
    }

    return context
  }

  public walk(pathOrNode: Node | string, fn: WalkFn) {
    let node: Node | null
    if (typeof pathOrNode === 'string') {
      node = this.lookup(pathOrNode)
    } else {
      node = pathOrNode
    }

    if (!node) return

    const queue: Node[] = [node]

    while (queue.length) {
      const n = queue.shift()
      if (!n) continue
      fn(n)
      queue.push(...n.children)
    }
  }

  public countAllChildren(pathOrNode: Node | string = this.root, onlyFiles: boolean = true): number {
    let count = 0
    this.walk(pathOrNode, node => {
      count += onlyFiles ? this.countDirectChildren(node) : node.children.length
    })

    return count
  }

  public countDirectChildren(pathOrNode: Node | string = this.root): number {
    const node: Node | null = typeof pathOrNode === 'string'
      ? this.lookup(pathOrNode)
      : pathOrNode

    if (!node) return 0

    // only counts "files"
    return node.children.filter(child => child.children.length === 0).length
  }
}