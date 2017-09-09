import { CloudFront } from 'aws-sdk'

const cf = new CloudFront()

export const bucketToDomain = (bucketName: string): string => `${bucketName}.s3.amazonaws.com`

export async function listDistributions(): Promise<CloudFront.DistributionSummary[]> {
  let marker = ''
  let complete = false
  let distributions: CloudFront.DistributionSummary[] = []

  while (!complete) {
    const params: CloudFront.ListDistributionsRequest = {}
    if (marker) {
      params.Marker = marker
    }

    const result = await cf.listDistributions(params).promise()
    if (!result.DistributionList) {
      complete = true
      break
    }

    if (result.DistributionList.Items) {
      distributions = distributions.concat(result.DistributionList.Items)
    }

    if (result.DistributionList.IsTruncated && result.DistributionList.NextMarker) {
      marker = result.DistributionList.NextMarker
    } else {
      complete = true
    }
  }

  return distributions
}

export interface FindDistributionsOptions {
  bucketName?: string
  ids?: string[]
}

export async function findDistributions({
  bucketName = '',
  ids = [],
}: FindDistributionsOptions): Promise<CloudFront.DistributionSummary[]> {
  const distributions = await listDistributions()
  const domainName = bucketToDomain(bucketName)

  return distributions.filter(dist => {
    if (ids.length) {
      const foundExplicitly = ids.some(id => dist.Id === id)
      if (foundExplicitly) return true
    }

    if (!dist.Origins.Quantity || !dist.Origins.Items || !dist.Origins.Items.length) return false

    return dist.Origins.Items.some(origin => origin.DomainName === domainName)
  })
}

export interface CloudFrontInvalidatorOptions {
  bucketName: string
  paths: string[]
  ids?: string[]
}

export interface InvalidateResponse {
  committed: boolean
  count: number
  reason: 'NO_PATHS' | 'NO_DISTS' | 'COMMITTED'
}

export default class CloudFrontInvalidator {
  public readonly bucketName: string
  public readonly paths: string[]
  public readonly ids: string[] = []

  private distributions: CloudFront.DistributionSummary[] | undefined

  constructor(options: CloudFrontInvalidatorOptions) {
    this.bucketName = options.bucketName
    this.paths = options.paths.filter((path, i) => options.paths.indexOf(path) === i)
    if (options.ids) {
      this.ids = options.ids
    }
  }

  public async constitutesPayment(): Promise<boolean> {
    const distributions = await this.getDistributions()
    return distributions.length * this.paths.length > 1000
  }

  public async invalidate(enabledOnly: boolean = true): Promise<InvalidateResponse> {
    if (!this.paths.length) {
      return {
        committed: false,
        count: 0,
        reason: 'NO_PATHS',
      }
    }

    const distributions = (await this.getDistributions()).filter(dist => {
      if (enabledOnly) return dist.Enabled
      return true
    })

    if (!distributions.length) {
      return {
        committed: false,
        count: 0,
        reason: 'NO_DISTS',
      }
    }

    await Promise.all(distributions.map(dist => {
      return cf.createInvalidation({
        DistributionId: dist.Id,
        InvalidationBatch: {
          CallerReference: Date.now().toString(),
          Paths: {
            Quantity: this.paths.length,
            Items: this.paths,
          },
        },
      } as CloudFront.CreateInvalidationRequest).promise()
    }))

    return {
      committed: true,
      count: distributions.length * this.paths.length,
      reason: 'COMMITTED',
    }
  }

  public async getDistributions(): Promise<CloudFront.DistributionSummary[]> {
    if (!this.distributions) {
      const options: FindDistributionsOptions = {}
      // Explicit ids overrides bucketName
      if (this.ids.length) {
        options.ids = this.ids
      } else {
        options.bucketName = this.bucketName
      }
      this.distributions = await findDistributions(options)
    }

    return this.distributions
  }
}