'use client'

import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts'
import QueryProvider from '@/providers/query-provider'
import { ThemeProvider } from '@/providers/theme-provider'

export default function Provider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryProvider>
        <AuthProvider>
          <TooltipProvider>{children}</TooltipProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  )
}
