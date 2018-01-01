const Path = require('path')

const DOWNLOAD_CONTENT_TYPE = 'application/octet-stream'
const DOWNLOAD_TAG = 'Downloadable'
const REDIRECT_TAG = 'Redirectable'

const makeDispositionName = fileName =>
  `${Path.basename(fileName).split('.')[0]}-${Date.now()}${Path.extname(fileName)}`

module.exports = {
  source: './public',
  target: 's3://websync-complex-example-bucket',
  // Put options are a powerful and flexible way to modify objects before they are sent to S3
  putOptions: {
    // Modifier as a plain object
    '**/*': {
      Metadata: {
        'source-user': process.env.USER,
      },
    },
    // Modifier as a function
    'download/**/*': item => ({
      ContentType: DOWNLOAD_CONTENT_TYPE,
      ContentDisposition: makeDispositionName(item.key),
      Tagging: DOWNLOAD_TAG,
    }),
    // Modifier as an `async` function
    '*.redirect': async item => ({
      WebsiteRedirectLocation: (await item.read()).toString().trim(),
      Tagging: REDIRECT_TAG,
    }),
    'private/**/*': {
      ACL: 'private',
    },
  },
}