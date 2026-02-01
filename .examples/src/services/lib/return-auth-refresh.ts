import type { ReturnFetch } from 'return-fetch'
import returnFetch from 'return-fetch'
import type { ApiResponse, Token } from '.'
import { setToken } from '../token'

let retryCount = 0
let refreshing = false
let refreshPromise: Promise<void> | null = null

export const returnFetchAuthRefresh: ReturnFetch = (args) =>
  returnFetch({
    ...args,
    interceptors: {
      response: async (response, requestArgs, fetch) => {
        if (response.status !== 401) {
          return response
        }

        if (refreshing) {
          await refreshPromise
          return fetch(...requestArgs)
        }

        refreshing = true
        refreshPromise = fetch(
          `${process.env.NEXT_PUBLIC_API_BASE_PATH}/auth/refresh`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
          .then(async (responseToRefresh) => {
            if (responseToRefresh.status !== 200) {
              throw Error('failed to refresh cookie')
            }

            const newToken =
              (await responseToRefresh.json()) as ApiResponse<Token>

            setToken(newToken.data)

            retryCount += 1
            console.log(
              `🔄 succeeded to refresh and retry request ${retryCount}`,
              newToken,
            )

            refreshing = false
            refreshPromise = null
          })
          .catch((error) => {
            refreshing = false
            refreshPromise = null
            throw error
          })

        await refreshPromise
        console.log('refreshing after fetch', requestArgs)
        return fetch(...requestArgs)
      },
    },
  })
