import { fetchExtended, type ApiResponse } from '@/services'

export const logout = async () => {
  const response = await fetchExtended<ApiResponse<null>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/auth/logout`,
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
