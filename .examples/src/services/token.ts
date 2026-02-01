import type { Token } from './types'

let token: Token | null = null

export const getToken = (): Token | null => {
  return token
}

export const setToken = (newToken: Token | null) => {
  token = newToken
}
