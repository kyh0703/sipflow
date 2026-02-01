import { errorMessages, type ErrorCode } from '@/constants/http-error'

export interface Token {
  accessToken: string
}

export interface PaginationMeta {
  total: number
  page: number
  pageSize: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PaginationResponse<T> {
  data: T[]
  meta: PaginationMeta
}

export interface PaginationQuery {
  page?: number
  pageSize?: number
}

export type ApiResponse<T> = {
  statusCode: number
  message: string | string[]
  data: T
  error?: string | object
}

export class CustomError extends Error {
  public code: ErrorCode
  public message: string
  public status: number

  constructor(code: number, status: number, message: string) {
    super(message ?? errorMessages.get(code) ?? 'Unknown error')
    this.code = code
    this.message = errorMessages.get(code) ?? message ?? 'Unknown error'
    this.status = status
    this.name = 'CustomError'
  }
}
