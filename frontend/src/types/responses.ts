/**
 * API Error type matching Go backend handler.Response
 */
export interface ApiError {
  code: string
  message: string
}

/**
 * Generic API Response type matching Go backend handler.Response[T]
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: ApiError
}
