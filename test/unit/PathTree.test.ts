import { expect } from 'chai'

import PathTree, { Node } from '../../src/PathTree'

describe('PathTree', () => {
  it('constructs a tree from an array of paths', () => {
    const paths = [
      'foo/a/b.txt',
      'foo/a/c.jpg',
      'foo/d.png',
    ]

    const tree = new PathTree(paths)
    const root = tree.lookup('/')
    if (!root) {
      throw new Error('Failed to lookup "root" node')
    }
    expect(root.name).to.equal('%ROOT%')
    const foo = tree.lookup('/foo')
    if (!foo) {
      throw new Error('Failed to lookup "foo" node')
    }
    // foo node
    expect(foo.children).to.have.length(2)
    expect(foo.parent).to.equal(root)

    const [a, d] = foo.children
    // a node
    expect(a.name).to.equal('a')
    expect(a.parent).to.equal(foo)
    expect(a.children).to.have.length(2)
    const [b, c] = a.children
    // b node
    expect(b.name).to.equal('b.txt')
    expect(b.parent).to.equal(a)
    expect(b.path).to.equal('foo/a/b.txt')
    // c node
    expect(c.name).to.equal('c.jpg')
    expect(c.parent).to.equal(a)
    expect(c.path).to.equal('foo/a/c.jpg')
    // d node
    expect(d.name).to.equal('d.png')
    expect(d.path).to.equal('foo/d.png')
    expect(d.parent).to.equal(foo)
  })

  it('lookup', () => {
    const tree = new PathTree([
      'a/b.txt',
      'c.txt',
    ])

    const a = tree.lookup('a')
    if (!a) {
      throw new Error('Look up of node "a" failed')
    }
    expect(a.name).to.equal('a')
    expect(a.children).to.have.length(1)

    const nope = tree.lookup('nope')
    expect(nope).to.equal(null)
  })

  it('counts child nodes', () => {
    const tree = new PathTree([
      'foo/a/b.txt',
      'foo/a/c.txt',
      'foo/d.txt',
    ])

    expect(tree.countAllChildren('/')).to.equal(3)
    expect(tree.countAllChildren('/foo')).to.equal(3)
    expect(tree.countAllChildren('/foo', false)).to.equal(4)
    expect(tree.countAllChildren('/foo/a')).to.equal(2)
    expect(tree.countAllChildren('/foo/a', false)).to.equal(2)
  })

  it('counts direct child nodes', () => {
    const tree = new PathTree([
      'foo/a/b.txt',
      'foo/a/c.txt',
    ])

    expect(tree.countDirectChildren('/foo/a')).to.equal(2)
  })
})