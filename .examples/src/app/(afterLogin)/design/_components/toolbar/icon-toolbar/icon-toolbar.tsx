'use client'

import { Separator } from '@/components/ui/separator'
import { ActionToolbar, EditorToolbar, ViewerToolbar } from '.'

export function IconToolbar() {
  return (
    <div className="h-full w-full">
      <div className="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-border/40 flex items-center gap-1 rounded-lg border p-2 shadow-lg backdrop-blur">
        <ViewerToolbar />
        <Separator orientation="vertical" />
        <EditorToolbar />
        <Separator orientation="vertical" />
        <ActionToolbar />
      </div>
    </div>
  )
}
