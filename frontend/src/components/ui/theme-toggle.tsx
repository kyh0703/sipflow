import { ChevronDown } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

import { cn } from '@/lib/utils'

import { Button } from './button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from './dropdown-menu'

export function ThemeToggle({ className }: { className?: string } = {}) {
  const [mounted, setMounted] = useState(false)
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            'h-9 rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground shadow-none hover:bg-muted',
            className,
          )}
        >
          <span>Theme</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36 rounded-md p-1">
        <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="system">System</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">Dark</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="light">Light</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
