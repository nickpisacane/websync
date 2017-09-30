export const ErrorCodes = {
  TransferFailed: 1,
  TooManyInvalidations: 2,
  InvalidationsFailed: 3,
}

export class Base extends Error {
  public code: number

  constructor(msg: string, code: number) {
    super(msg)

    this.code = code
  }
}

export class TransferFailed extends Base {
  public transferError: Error

  constructor(transferError: Error) {
    super(`Syncer: Transfer Failed.`, ErrorCodes.TransferFailed)

    this.transferError = transferError
  }
}

export class TooManyInvalidations extends Base {
  constructor() {
    super(`Syncer: Too many invalidations.`, ErrorCodes.TooManyInvalidations)
  }
}

export class InvalidationsFailed extends Base {
  public invalidationsError: Error

  constructor(invalidationsError: Error) {
    super(`Syncer: Invalidations Failed`, ErrorCodes.InvalidationsFailed)

    this.invalidationsError = invalidationsError
  }
}