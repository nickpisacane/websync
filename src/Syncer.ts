import { parse as parseURL, Url } from 'url'
import Container from './Container'

export interface SyncerOptions {
  source: string
  target: string
}

export default class Syncer {
  private sourceURL: Url
  private targetURL: Url
  private source: Container
  private target: Container
  
  constructor(options: SyncerOptions) {
    this.sourceURL = parseURL(options.source)
    this.targetURL = parseURL(options.target)

  }
}