import { fetchExtended, type ApiResponse } from '@/services'

export const refresh = async () => {
  const response = await fetchExtended<ApiResponse<string>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/auth/refresh`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    },
  )

  return response.body.data
}
