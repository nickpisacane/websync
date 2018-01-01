export type Listener = (...args: any[]) => void | Promise<void>

/**
 * Simple EventEmitter that supports `async` listeners (listeners that return a `Promise`)
 * @NOTE: Not attempting to be, nor close to being, a mirror implementation of the native `EventEmitter`
 */
export default class AsyncEventEmitter {
  private _events: { [key: string]: Listener[] } = {}

  public on(event: string, listener: Listener): this {
    if (!this._events.hasOwnProperty(event)) {
      this._events[event] = []
    }
    this._events[event].push(listener)

    return this
  }

  public once(event: string, listener: Listener): this {
    const wrapper: Listener = async (...args: any[]): Promise<void> => {
      await listener(...args)
      this.removeListener(event, wrapper)
    }

    this.on(event, wrapper)

    return this
  }

  public removeListener(event: string, listener: Listener) {
    if (this._events.hasOwnProperty(event)) {
      const idx = this._events[event].indexOf(listener)
      if (~idx) {
        this._events[event].splice(idx, 1)
      }
    }
  }

  public removeAllListeners(event?: string) {
    if (event) {
      if (this._events.hasOwnProperty(event)) {
        this._events[event] = []
      }
    } else {
      this._events = {}
    }
  }

  public async emit(event: string, ...args: any[]): Promise<boolean> {
    if (this._events.hasOwnProperty(event)) {
      await this._events[event].reduce(async (p: Promise<void>, listener: Listener): Promise<void> => {
        await p
        await listener(...args)
      }, Promise.resolve())

      return true
    }

    return false
  }
}