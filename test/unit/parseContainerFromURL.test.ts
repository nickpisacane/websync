import { expect } from 'chai'

import parseContainerFromURL from '../../src/parseContainerFromURL'
import FileContainer from '../../src/FileContainer'
import S3Container from '../../src/S3Container'

describe('parseContainerFromURL', () => {
  describe('File URLs', () => {
    it('parses relative file paths', () => {
      const container = parseContainerFromURL('./foo')
      expect(container).to.be.instanceof(FileContainer)
      expect(container.type).to.equal('FILE')
      expect((container as any).baseDirectory).to.equal('./foo')

      const container2 = parseContainerFromURL('foo')
      expect(container2).to.be.instanceof(FileContainer)
      expect(container2.type).to.equal('FILE')
      expect((container2 as any).baseDirectory).to.equal('foo')
    })

    it('parses absoluate file paths', () => {
      const container = parseContainerFromURL('/foo/bar')
      expect(container).to.be.instanceof(FileContainer)
      expect(container.type).to.equal('FILE')
      expect((container as any).baseDirectory).to.equal('/foo/bar')
    })

    it('parses absoluate file URLs', () => {
      const abs = parseContainerFromURL('file:///foo/bar')
      expect(abs).to.be.instanceof(FileContainer)
      expect(abs.type).to.equal('FILE')
      expect((abs as any).baseDirectory).to.equal('/foo/bar')

      const rel = parseContainerFromURL('file://foo/bar')
      expect(rel).to.be.instanceof(FileContainer)
      expect(rel.type).to.equal('FILE')
      expect((rel as any).baseDirectory).to.equal('foo/bar')

      const rel2 = parseContainerFromURL('file://./foo/bar')
      expect(rel2).to.be.instanceof(FileContainer)
      expect(rel2.type).to.equal('FILE')
      expect((rel2 as any).baseDirectory).to.equal('./foo/bar')
    })
  })

  describe('S3 URLs', () => {
    it('parses S3 URLs (without prefix)', () => {
      const container = parseContainerFromURL('s3://mybucket')
      expect(container).to.be.instanceof(S3Container)
      expect(container.type).to.equal('S3')
      expect((container as any).prefix).to.equal('')
    })

    it('parses S3 URLs (with prefix)', () => {
      const container = parseContainerFromURL('s3://mybucket/foo/bar')
      expect(container).to.be.instanceof(S3Container)
      expect(container.type).to.equal('S3')
      expect((container as any).prefix).to.equal('foo/bar')
    })
  })

  describe('Unsupported URLs', () => {
    it('throws an error', () => {
      try {
        parseContainerFromURL('http://test.com/foo')
        throw new Error('FAILED')
      } catch (err) {
        expect(err.message).to.equal(`Could not interpret URL: "http://test.com/foo"`)
      }
    })
  })
})