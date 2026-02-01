import { QueryClient } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // With SSR, we usually want to set some default staleTime
      // above 0 to avoid refetching immediately on the client
      // staleTime: 60 * 1000,
      retry: 1,
      throwOnError: true,
    },
    mutations: {
      throwOnError: true,
    },
  },
})

export default queryClient
