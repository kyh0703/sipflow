'use client'

import { Button } from '@/components/ui/button'
import { Redo2, Undo2 } from 'lucide-react'

export function EditorToolbar() {
  const handleUndoClick = () => {}

  const handleRedoClick = () => {}

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        disabled
        onClick={handleUndoClick}
      >
        <Undo2 className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0"
        onClick={handleRedoClick}
      >
        <Redo2 className="h-4 w-4" />
      </Button>
    </div>
  )
}
