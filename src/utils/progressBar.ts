import * as ProgressBar from 'progress'

export default function progressBar(format: string, total: number = 15) {
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