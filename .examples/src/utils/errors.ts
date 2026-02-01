import { CustomError } from '../services'

export function extractErrorMessage(error: unknown): string {
  if (error instanceof CustomError) {
    return error.message
  } else if (error instanceof Error) {
    return error.message
  } else if (typeof error === 'string') {
    return error
  }
  return 'Unknown error'
}
