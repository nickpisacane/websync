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

export async function findDistributions(
  bucketName: string,
  ids: string[] = []
): Promise<CloudFront.DistributionSummary[]> {
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

export default class CloudFrontInvalidator {
  public readonly bucketName: string
  public readonly paths: string[]
  public readonly ids: string[] = []

  private distributions: CloudFront.DistributionSummary[] | undefined

  constructor(options: CloudFrontInvalidatorOptions) {
    this.bucketName = options.bucketName
    this.paths = options.paths
    if (options.ids) {
      this.ids = options.ids
    }
  }

  public async constitutesPayment(): Promise<boolean> {
    const distributions = await this.getDistributions()
    return distributions.length * this.paths.length > 1000
  }

  public async invalidate(enabledOnly: boolean = true) {
    const distributions = (await findDistributions(this.bucketName, this.ids)).filter(dist => {
      if (enabledOnly) return dist.Enabled
      return true
    })


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
  }

  public async getDistributions(): Promise<CloudFront.DistributionSummary[]> {
    if (!this.distributions) {
      this.distributions = await findDistributions(this.bucketName, this.ids)
    }

    return this.distributions
  }
}