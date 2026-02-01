'use client'

import { Button } from '@/components/ui/button'
import { Menu, X, MoreHorizontal, Plus, Cloud, RotateCcw } from 'lucide-react'

export function Header() {
  return (
    <div className="flex items-center justify-between p-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon">
          <Menu className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <Cloud className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
