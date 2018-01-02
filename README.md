# Websync
![travis](https://travis-ci.org/nickpisacane/websync.svg?branch=master)

Websync sync is meant to be a replacement for `aws s3 sync`. Websync, like the AWS cli, syncs local directories with s3 prefixes, and visa-versa. Websync expands on these features by automatically creating *optimized* invalidations on any associated CloudFront distributions, and exposing an expressive configuration system (on top of the CLI interface) with JSON or JavaScript, and a programmatic API.

# Table Of Contents
* [Installation](#installation)
* [Usage](#usage)
* [Configuration Files](#configuration-files)
* [Item API](#item-api)
* [Invalidation System](#invalidation-system)
* [Wildcard Policies](#wildcard-policies)
* [Roadmap](#roadmap)


# Installation
```sh
# Install global cli, the `websync` command
npm i -g websync
# Install local
npm i websync
```

# Usage
## websync command
```sh
# Parse configuration from `websync.json` or `websync.js`
websync
# Parse configuration explicitly
websync --config ./myConfig.js
# With command line options
websync ./www s3://mybucket.io
# General
websync [source] [target] [...options]
```
### Options
* `source` Source container (local directory or S3 bucket): `--source ./myDirectory`
* `target` Target container (S3 bucket or local directory): `s3://my-bucket`
* `config` Explicit configuration file (JSON or JavaScript): `--config ./myConfig.json`
* `include` Glob pattern to filter files (from source) to include: `--include **/*.ext`
* `exclude` Glob pattern to filter files (from source) to exclude: `--exclude **/*.ext`
* `diffBy`  Override property by which items are diffed (`modtime`, or `size` with default: `modtime`): `--diffBy size`
* `wildcardPolicy` Override the wildcard policy (`majority`, `unanimous`, or `minority` with default: `majority`): `--wildcardPolicy unanimous`
* `wildcardAll` Append wildcard to _all_ invalidation paths (NOTE: this does not change invalidation path resolution), useful for invalidating querystring paths: `--wildcardAll`
* `invalidateDeletes` Invalidate paths for items being _deleted_ from target. Useful for situations where you _do not_ want users to be able to access the items anymore: `--invalidateDeletes`
* `distribution` One or more CloudFront distribution IDs (NOTE: this overrides discovery of distributions): `--distribution <DIST ID> --distribution <ANOTHER DIST ID>`
* `yes` Skip all prompts with a "yes" response (NOTE: websync will warn you if more than 500 invalidations are being made, as this will require a payment): `--yes`

**NOTE**: More options are available in the [Configuration Files](#configuration-files)

**NOTE**: All command line arguments _OVERRIDE_ configuration file options. Additionally, `source` and `target` are _required_, but can be provided by CLI or Configuration File


# Configuration Files
Configuration files can provide all of the options available from the CLI with the addition of `modifiers`, a flexible system to provide explicit arguments to S3 put operations.
## Modifiers Object
The modifier object of the configuration file is an object in which the `keys` are Glob Patterns, and the `values` are [`S3.putObject Params`](https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#putObject-property), or a function that returns either an `S3.putObject Params`, or a Promise which resolves `S3.putObject Params`. Note, if a function is provided (async or not) it will be called with a single [`Item`](#item-api) argument that will represent the file or object from the _SOURCE_ container.
**NOTE**: Source files can match **multiple** modifiers, allowing one to keep things DRY.
### Examples
JavaScript configuration. See the [example](https://github.com/nickpisacane/websync/tree/master/examples/complex) for context.
```js
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
    // This matches all files, provides Plain Object
    '**/*': {
      Metadata: {
        'source-user': process.env.USER,
      },
    },
    // Matches all files in downloads, provides a synchronous function
    'downloads/**/*': item => ({
      ContentType: DOWNLOAD_CONTENT_TYPE,
      ContentDisposition: `attachment; filename="${makeDispositionName(item.key)}"`,
      Tagging: DOWNLOAD_TAG,
    }),
    // Matches any file with the `.redirect` extension, provides an asynchronous funcion
    '*.redirect': async item => ({
      WebsiteRedirectLocation: (await item.read()).toString().trim(),
      ContentType: 'text/html',
      Tagging: REDIRECT_TAG,
    }),
  },
}
```
JSON configuration. See the [example](https://github.com/nickpisacane/websync/tree/master/examples/basic) for context. In the example below, the `!*.*` pattern matches any item with _no extension_, i.e. "another-page", and overrides the implied `Content-Type` with `text/html` to have clean paths for a simple static website.
```json
{
    "source": "./public",
    "target": "s3://websync-basic-example-bucket",
    "exclude": "*.exclude",
    "modifiers": {
        "!*.*": {
            "ContentType": "text/html"
        }
    }
}
```

# Item API
Websync's `Item` object is an interface that abstractly represents either a local file, or an `S3` Object. With regards to the [`Configuration File`](#configuration-files), the `Item` object passed to a `modifier` function is always from the __source__ container (local directory, or `S3` Bucket). All `Item`s adhere to the following interface:
```ts
interface Item {
  // The "key" (path or S3 Object key)
  key: string
  // Last modification time
  modtime: Date
  // Size in bytes of the Item
  size: number
  // Whether item is a symbolic link (always false for S3)
  isSymbolicLink: boolean
  // Read the *entire* body of the item
  read(): Promise<Buffer>
}
```

# Invalidation System
Websync's invalidation system automatically creates the minimal amount of invalidation paths required to accommodate the provided `wildcard` policy. It does this by creating a `diff` of the target and the `source`, and two trees: one of the items in the `diff` and all of the items in the `target`. It then walks the `diff` (starting at the root) tree and compares the number of children that are being invalidated with those that are not -- this is where the `wildcard` policy makes all the difference. Additionally, websync will detect when a given path that is being wildcarded should invalidate all of its children, or only its direct children, thereby producing the most optimal invalidation paths.

***NOTE***: the `wildcardAll` option _DOES NOT_ change the invalidation path generation, rather, wildcards are appended to every path generated. This is useful for invalidating querystring paths for a given object, etc.

For more information on how invalidations work on CloudFront, please refer to the [AWS Documentation](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Invalidation.html#invalidation-specifying-objects).

# Wildcard Policies
Wildcard policies determine when a given path will be _wildcarded_, thereby invalidating, all or only its direct, children to reduce the number of invalidation paths generated. The three policies available from least _strict_ to most _strict_ include `minority`, `majority`, and `unanimous`. 

## minority
A given path is wildcarded when a _minority_ of its children are being invalidated. **NOTE**: This always results in a the `/*` invalidation path, when invalidations are required.
#### Example:
All Target Items:
* `/`
  * `/css`
    * `main.css`
    * `vendor.css`
  * `/js`
    * `main.js`
  * `index.html`

Invalidated Items:
  * `/`
    * `index.html`

Invalidation Paths:
  * `/*`
## majority
A given path is wildcarded when a _majority_ of its children are being invalidated.
#### Example:
All Target Items:
* `/`
  * `/css`
    * `main.css`
    * `vendor.css`
  * `/js`
    * `main.js`
  * `index.html`

Invalidated Items:
  * `/`
    * `/css`
      * `main.css`
      * `vendor.css`
    * `index.html`

Invalidation Paths:
  * `/css/*`
  * `/index.html`
## unanimous
A given path is wildcarded when a _all_ of its children are being invalidated.
#### Example:
All Target Items:
* `/`
  * `/css`
    * `main.css`
    * `vendor.css`
  * `/js`
    * `main.js`
  * `index.html`

Invalidated Items:
  * `/`
    * `/css`
      * `main.css`
    * `/js`
      * `/main.js`
    * `index.html`

Invalidation Paths:
  * `/css/main.css`
  * `/js/*`
  * `/index.html`

# Roadmap
- [x] Initial CLI
- [ ] Programmatic API Documentation
- [ ] Better Roadmap
