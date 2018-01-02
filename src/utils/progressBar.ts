import * as ProgressBar from 'progress'

export type ProgressBarTokens = { [key: string]: string }
export type ProgressBarFunc = (percentComplete: number, tokens?: ProgressBarTokens) => void

/**
 * Returns a function `ProgressBarFunc` to be called progressively with `percentComplete`, and
 * an optional map of `tokens` to be interpolated into the format string.
 */
export default function progressBar(format: string, total: number = 15): ProgressBarFunc {
  let tick = 0
  const bar = new ProgressBar(format, {
    total,
    incomplete: ':',
    complete: '\u2588',
  })

  return (percentComplete: number, tokens: { [key: string]: string } = {}) => {
    if (bar.complete) return
    const delta = Math.floor(percentComplete * total) - tick
    tick += delta
    bar.tick(delta, tokens)
  }
}