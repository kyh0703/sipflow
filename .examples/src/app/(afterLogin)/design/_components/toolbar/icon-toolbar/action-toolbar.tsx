'use client'

import { Button } from '@/components/ui/button'
import { Play } from 'lucide-react'

export function ActionToolbar() {
  const handleRunClick = () => {
    console.log('run')
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 px-3 text-xs"
        onClick={handleRunClick}
      >
        <Play className="mr-1 h-4 w-4" />
        Run
      </Button>
    </div>
  )
}
