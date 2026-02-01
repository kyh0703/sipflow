import type { ReturnFetchDefaultOptions } from 'return-fetch'
import returnFetch from 'return-fetch'
import { returnFetchAuthHeader } from './return-auth-header'
import { returnFetchAuthRefresh } from './return-auth-refresh'
import { returnFetchBody } from './return-body'
import { returnFetchThrowError } from './return-error-throw-error'

const defaultOption: ReturnFetchDefaultOptions = {
  interceptors: {
    request: async (args) => {
      const [url, requestInit] = args
      console.log(`> 🚨 [API] (${requestInit?.method}) ${url.toString()}`, args)
      return args
    },
    response: async (response, args) => {
      const [url, requestInit] = args
      console.log(`< 🚨 [API] (${requestInit?.method}) ${url.toString()}`, args)
      return response
    },
  },
}

export const fetchExtended = returnFetchBody({
  fetch: returnFetchThrowError({
    fetch: returnFetchAuthRefresh({
      fetch: returnFetchAuthHeader({
        fetch: returnFetch(defaultOption),
      }),
    }),
  }),
})
