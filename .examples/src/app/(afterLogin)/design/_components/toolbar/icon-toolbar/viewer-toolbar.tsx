'use client'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib'
import { useCursor, useFlowActions } from '@/stores/flow-store'
import { Hand, MousePointer, Move } from 'lucide-react'

const cursorOptions = [
  {
    mode: 'pointer' as const,
    icon: MousePointer,
    label: 'Select',
  },
  {
    mode: 'grab' as const,
    icon: Hand,
    label: 'Pan',
  },
  {
    mode: 'link' as const,
    icon: Move,
    label: 'Move',
  },
]

export function ViewerToolbar() {
  const cursorMode = useCursor()
  const { setCursorMode } = useFlowActions()

  return (
    <div className="flex items-center gap-1">
      {cursorOptions.map(({ mode, icon: Icon, label }) => {
        const isActive = cursorMode === mode
        return (
          <Button
            key={mode}
            variant={isActive ? 'default' : 'ghost'}
            size="sm"
            className={cn(
              'h-8 w-8 p-0 transition-all',
              isActive && 'bg-primary text-primary-foreground shadow-sm',
            )}
            onClick={() => setCursorMode(mode)}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </Button>
        )
      })}
    </div>
  )
}
