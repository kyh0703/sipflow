import { fetchExtended, type ApiResponse } from '@/services'

export const resetPassword = async (data: {
  token: string
  password: string
  passwordConfirm: string
}) => {
  const response = await fetchExtended<ApiResponse<null>>(
    `${process.env.NEXT_PUBLIC_BASE_PATH}/auth/reset-password`,
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
