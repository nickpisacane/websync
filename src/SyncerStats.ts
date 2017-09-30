import { CloudFront } from 'aws-sdk'

import { ItemDiff } from './types'

export default class SyncerStats {
  public diffs: ItemDiff[]
  public distributions?: CloudFront.DistributionSummary[]
  public invalidations?: string[]

  public toString({ colors = true }: { colors: boolean }): string {
    return 'TODO'
  }
}