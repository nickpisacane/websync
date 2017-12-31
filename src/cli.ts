import * as readLine from 'readline'
import * as minimist from 'minimist'
import * as AWS from 'aws-sdk'
import Websync, { WebsyncOptions, WebsyncTransferProgressEvent } from './Websync'
import Config, { ConfigFile } from './Config'
import progressBar from './utils/progressBar'

const help = `
websync [source] [target] [...options]
websync [...options]

Options:
  -h, --help           Show this message
  -y, --yes            Skip prompts with a "yes" by default
  --config             Provide a configuration file (js or json)
  --include            Pattern to include
  --exclude            Patter to exclude
  --wildcardPolicy     Set the wildcard policy (majority, minority, or unanmious)
  --wildcardAll        Append wildcard to all invalidations
  --invalidateDeletes  Invalidate delete transfers
  --distribution       One or more CloudFront distribution IDs to invalidate
`

const rl = readLine.createInterface({
  input: process.stdin,
  output: process.stdout,
})

const showHelp = () => {
  console.error(help)
  process.exit(1)
}

const prompt = (msg: string): Promise<boolean> => new Promise((resolve, reject) => {
  rl.question(msg, answer => {
    resolve(/^y/i.test(answer))
  })
})

export default async () => {
  const argv = process.argv.slice(2)
  const args = minimist(argv)
  if (args.h || args.help) {
    showHelp()
  }
  const defaultYes = !!args.y || !!args.yes
  const configFileName = args.config || ''
  const config = new Config({
    argv,
    configFileName,
  })
  let options: ConfigFile
  try {
    options = await config.resolve()
  } catch (err) {
    return showHelp()
  }

  const progress = progressBar('|:bar| :success :key :time ms')
  const websync = new Websync(options)

  websync.on('progress', (event: WebsyncTransferProgressEvent) => {
    progress(event.progress, {
      success: 'TODO',
      key: event.item.key,
      time: `${event.time}`,
    })
  })
  await websync.initialize()

  let shouldInvalidate = true
  if (websync.constitutesPayment()) {
    const stats = websync.getStats()
    const len = stats.invalidations ? stats.invalidations.length : 0
    shouldInvalidate = await prompt(
      `The current transfer has ${len} invalidations, which will incur a charge. ` +
      `Would you like to proceed? (Y/N)`
    )
  }

  const stats = await websync.sync(shouldInvalidate)
  console.log(stats.toString())
}