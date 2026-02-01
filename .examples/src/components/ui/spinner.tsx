import { cn } from '@/lib/utils'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export function Spinner({ size = 'md', className }: Readonly<SpinnerProps>) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-current border-t-transparent',
        size === 'sm' && 'h-4 w-4 border-2',
        size === 'md' && 'h-6 w-6 border-2',
        size === 'lg' && 'h-8 w-8 border-[3px]',
        size === 'xl' && 'h-10 w-10 border-[3px]',
        className,
      )}
    />
  )
}
