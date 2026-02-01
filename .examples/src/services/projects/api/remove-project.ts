import { fetchExtended, type ApiResponse } from '@/services'

export const removeProject = async (id: string) => {
  const response = await fetchExtended<ApiResponse<null>>(
    `${process.env.NEXT_PUBLIC_API_BASE_PATH}/projects/${id}`,
    {
      method: 'DELETE',
    },
  )

  return response.body
}
