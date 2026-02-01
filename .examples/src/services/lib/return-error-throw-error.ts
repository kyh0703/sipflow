import { CustomError, type ApiResponse } from '@/services'
import type { ReturnFetch } from 'return-fetch'
import returnFetch from 'return-fetch'
import { parseJsonSafely } from './return-body'

export const returnFetchThrowError: ReturnFetch = (args) =>
  returnFetch({
    ...args,
    interceptors: {
      response: async (response) => {
        if (response.status < 400) {
          return response
        }

        const text = await response.text()
        const body = parseJsonSafely(text) as ApiResponse<unknown>
        if (body.statusCode) {
          throw new CustomError(
            body.statusCode,
            response.status,
            body.message as string,
          )
        }

        throw new Error(text)
      },
    },
  })
