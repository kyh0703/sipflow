import { fetchExtended, type ApiResponse, type Token } from '@/services'

export const register = async (data: {
  email: string
  password: string
  passwordConfirm: string
  name: string
}) => {
  const response = await fetchExtended<ApiResponse<Token>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/auth/register`,
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
