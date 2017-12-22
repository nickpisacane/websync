import { CloudFront } from 'aws-sdk'

import { ItemDiff } from './types'

export interface StatsObject {
  diffs: ItemDiff[]
  distributions?: CloudFront.DistributionSummary[]
  invalidations?: string[]
  constitutesPayment: boolean
  completed: boolean
  invalidated: boolean
}

export default class Stats implements StatsObject {
  public diffs: ItemDiff[]
  public distributions?: CloudFront.DistributionSummary[]
  public invalidations?: string[]
  public constitutesPayment: boolean
  public completed: boolean
  public invalidated: boolean

  constructor(stats: Partial<StatsObject> = {}) {
    this.update(stats)
  }

  public update(stats: Partial<StatsObject>) {
    Object.assign(this, stats)
  }

  public toString({ colors = true }: { colors: boolean }): string {
    return 'TODO'
  }

  public clone(): Stats {
    return new Stats({
      diffs: this.diffs,
      distributions: this.distributions,
      invalidations: this.invalidations,
      constitutesPayment: this.constitutesPayment,
      completed: this.completed,
      invalidated: this.invalidated,
    })
  }
}