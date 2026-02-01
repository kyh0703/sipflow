import queryClient from '@/lib/query-client'
import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import type { PropsWithChildren } from 'react'

export default function QueryProvider({
  children,
}: Readonly<PropsWithChildren>) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
