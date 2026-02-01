import returnFetch, { type ReturnFetch } from 'return-fetch'
import { getToken } from '../token'

export const returnFetchAuthHeader: ReturnFetch = (args) =>
  returnFetch({
    ...args,
    interceptors: {
      request: async (args) => {
        const token = getToken()
        if (!token) {
          return args
        }

        const headers = new Headers(args[1]?.headers || {})
        headers.set('Authorization', `Bearer ${token.accessToken}`)

        return [
          args[0],
          {
            ...args[1],
            headers,
          },
        ]
      },
    },
  })
