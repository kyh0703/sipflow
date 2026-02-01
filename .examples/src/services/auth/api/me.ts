import type { User } from '@/models/user'
import { fetchExtended, type ApiResponse } from '@/services'

export const me = async () => {
  const response = await fetchExtended<ApiResponse<User>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/auth/me`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    },
  )

  return response.body.data
}
