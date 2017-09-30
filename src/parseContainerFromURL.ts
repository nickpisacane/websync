import * as Url from 'url'

import { Container } from './types'
import FileContainer from './FileContainer'
import S3Container from './S3Container'

const FILE_PROTO_RE = /^file\:\/\//

// file: ./foo/bar
// file: /foo/bar
// file: foo/bar
// file: file:///foo/bar
// s3: s3://buckename
// s3: s3://buckname/prefix
export default function parseContainerFromURL(url: string): Container {
  const urlObj = Url.parse(url)

  if (!urlObj.protocol) {
    return new FileContainer(url)
  }

  if (urlObj.protocol === 'file:') {
    return new FileContainer(url.replace(FILE_PROTO_RE, ''))
  }

  if (urlObj.protocol === 's3:') {
    if (!urlObj.hostname) {
      throw new Error(`Missing s3 bucket name.`)
    }
    const prefix = urlObj.pathname || ''
    return new S3Container(urlObj.hostname, prefix)
  }

  throw new Error(`Could not interpret URL: "${url}"`)
}
