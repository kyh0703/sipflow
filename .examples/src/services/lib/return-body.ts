import type { FetchArgs, ReturnFetchDefaultOptions } from 'return-fetch'
import returnFetch from 'return-fetch'

// Use as a replacer of `Response`
export type ResponseGenericBody<T> = Omit<
  Awaited<ReturnType<typeof fetch>>,
  keyof Body | 'clone'
> & {
  body: T
}

export type BodyResponse<T> = T extends object
  ? ResponseGenericBody<T>
  : ResponseGenericBody<string | Blob>

export const parseJsonSafely = (text: string): object | string => {
  try {
    return JSON.parse(text)
  } catch (e) {
    if ((e as Error).name !== 'SyntaxError') {
      throw e
    }

    return text.trim()
  }
}

// Write your own high order function to serialize request body and deserialize response body.
export const returnFetchBody = (args?: ReturnFetchDefaultOptions) => {
  const fetch = returnFetch(args)

  return async <T>(
    url: FetchArgs[0],
    init?: RequestInit,
  ): Promise<BodyResponse<T>> => {
    const response = await fetch(url, init)
    const contentType = response.headers.get('content-type')!
    let body: string | object | Blob
    if (contentType.includes('application/json')) {
      const textBody = await response.text()
      body = parseJsonSafely(textBody)
    } else if (
      contentType.includes('application/octet-stream') ||
      contentType.includes('image') ||
      contentType.includes('blob') ||
      contentType.includes('zip')
    ) {
      body = await response.blob()
    } else {
      body = await response.text() // For other content types like plain text
    }

    return {
      headers: response.headers,
      ok: response.ok,
      redirected: response.redirected,
      status: response.status,
      statusText: response.statusText,
      type: response.type,
      url: response.url,
      body,
    } as BodyResponse<T>
  }
}
