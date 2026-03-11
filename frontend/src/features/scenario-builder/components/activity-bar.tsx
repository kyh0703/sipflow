import { FolderTree, Puzzle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ActivityIconProps {
  icon: React.ComponentType<{ className?: string }>
  isActive: boolean
  onClick: () => void
  title: string
  disabled?: boolean
}

function ActivityIcon({ icon: Icon, isActive, onClick, title, disabled }: ActivityIconProps) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={cn(
        'relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
        disabled && 'opacity-40 cursor-not-allowed',
        !disabled && isActive && 'bg-background text-foreground shadow-sm',
        !disabled && !isActive && 'text-muted-foreground hover:bg-background/80 hover:text-foreground',
      )}
    >
      {isActive && (
        <div className="absolute left-0 top-2 bottom-2 w-0.5 rounded-r bg-primary" />
      )}
      <Icon className="h-4 w-4" />
    </button>
  )
}

interface ActivityBarProps {
  activePanel: 'scenario' | 'palette' | null
  onPanelSelect: (panel: 'scenario' | 'palette') => void
}

export function ActivityBar({ activePanel, onPanelSelect }: ActivityBarProps) {
  return (
    <div className="flex w-11 shrink-0 flex-col items-center border-r border-border bg-muted py-2">
      <div className="flex flex-col items-center gap-1">
        <ActivityIcon
          icon={FolderTree}
          isActive={activePanel === 'scenario'}
          onClick={() => onPanelSelect('scenario')}
          title="Scenario Tree"
        />
        <ActivityIcon
          icon={Puzzle}
          isActive={activePanel === 'palette'}
          onClick={() => onPanelSelect('palette')}
          title="Node Palette"
        />
      </div>
    </div>
  )
}
