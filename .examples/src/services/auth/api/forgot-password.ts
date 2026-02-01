import { fetchExtended, type ApiResponse } from '@/services'

export const forgotPassword = async (data: { email: string }) => {
  const response = await fetchExtended<ApiResponse<null>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/auth/forgot-password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify(data),
    },
  )

  return response.body.data
}
