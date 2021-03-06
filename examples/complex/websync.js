const Path = require('path')

const DOWNLOAD_CONTENT_TYPE = 'application/octet-stream'
const DOWNLOAD_TAG = 'Downloadable'
const REDIRECT_TAG = 'Redirectable'

const makeDispositionName = fileName =>
  `${Path.basename(fileName).split('.')[0]}-${Date.now()}${Path.extname(fileName)}`

module.exports = {
  source: './public',
  target: 's3://websync-complex-example-bucket',
  modifiers: {
    // Modifier as a plain object
    '**/*': {
      Metadata: {
        'source-user': process.env.USER,
      },
    },
    // Modifier as a function
    'downloads/**/*': item => ({
      ContentType: DOWNLOAD_CONTENT_TYPE,
      ContentDisposition: `attachment; filename="${makeDispositionName(item.key)}"`,
      Tagging: DOWNLOAD_TAG,
    }),
    // Modifier as an `async` function
    '*.redirect': async item => ({
      WebsiteRedirectLocation: (await item.read()).toString().trim(),
      ContentType: 'text/html',
      Tagging: REDIRECT_TAG,
    }),
  },
}