import type { IconButtonProps } from '@/components/icon'
import { cn } from '@/lib'
import { Start } from './start'

function withIconStyle(
  children: React.ReactNode,
): React.ComponentType<IconButtonProps> {
  const withPath = ({
    className,
    width = 24,
    height = 24,
    cursor,
    disabled,
    color,
    backgroundColor,
    onClick,
    ...props
  }: IconButtonProps) => {
    let cursorMode = cursor
    if (!cursorMode) {
      cursorMode = onClick ? 'pointer' : ''
    }

    return (
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          fontSize: `${(width + height) / 2}px`,
          backgroundColor: backgroundColor,
          color: color,
          cursor: disabled ? 'none' : cursorMode,
          opacity: disabled ? 0.1 : 1,
        }}
        className={cn('flex items-center justify-center', className)}
        {...props}
      >
        <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
          {children}
        </svg>
      </div>
    )
  }

  return withPath
}

export const StartIcon = withIconStyle(<Start />)
