'use client'

import { cn } from '@/lib/utils'
import { type PropsWithChildren } from 'react'
import ReactDOM from 'react-dom'

export type AbsolutePosition = {
  top?: number
  left?: number
  right?: number
  bottom?: number
}

export type ContextMenuProps = {
  className?: string
  onClick?: () => void
} & AbsolutePosition &
  PropsWithChildren

export default function ContextMenu({
  top,
  left,
  right,
  bottom,
  children,
  className,
  onClick,
  ...props
}: ContextMenuProps) {
  return ReactDOM.createPortal(
    <div
      className={cn(
        'absolute z-10 flex flex-col overflow-hidden rounded-sm bg-[#1E1E1E] text-white shadow-md',
        className,
      )}
      style={{ top, left, right, bottom }}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>,
    document.body,
  )
}
