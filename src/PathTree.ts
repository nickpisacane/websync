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
}

type WalkFn = (node: Node) => void

export default class PathTree {
  private root: Node

  constructor() {
    this.root = new Node('%ROOT%', '/')
  }

  public add(path: string): Node {
    const paths = splitPath(path)
    let context = this.root

    paths.forEach((path, i) => {
      let node = this.lookup(paths[i], context)
      if (!node) {
        node = new Node(paths[i], joinPaths(paths, i), context)
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

  public walk(pathOrNode: Node | string = this.root, fn: WalkFn) {
    let node: Node | null
    if (typeof pathOrNode === 'string') {
      node = this.lookup(pathOrNode)
    } else {
      node = pathOrNode
    }

    if (!node) return

    fn(node)
    node.children.forEach(child => {
      this.walk(child, fn)
    })
  }

  public countAllChildren(pathOrNode: Node | string = this.root): number {
    let count = 0
    this.walk(pathOrNode, node => {
      count += node.children.length
    })

    return count
  }
}