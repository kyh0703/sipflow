import { FolderTree, Puzzle, Settings } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'
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
        'relative flex items-center justify-center w-full h-10 transition-colors',
        disabled && 'opacity-40 cursor-not-allowed',
        !disabled && isActive && 'text-foreground',
        !disabled && !isActive && 'text-muted-foreground hover:text-foreground',
      )}
    >
      {isActive && (
        <div className="absolute left-0 top-2 bottom-2 w-0.5 bg-primary rounded-r" />
      )}
      <Icon className="w-5 h-5" />
    </button>
  )
}

interface ActivityBarProps {
  activePanel: 'scenario' | 'palette' | null
  onPanelToggle: (panel: 'scenario' | 'palette') => void
}

export function ActivityBar({ activePanel, onPanelToggle }: ActivityBarProps) {
  return (
    <div className="w-12 border-r border-border bg-muted flex flex-col items-center py-2 shrink-0">
      {/* Upper: panel icons */}
      <div className="flex flex-col items-center gap-1">
        <ActivityIcon
          icon={FolderTree}
          isActive={activePanel === 'scenario'}
          onClick={() => onPanelToggle('scenario')}
          title="Scenario Tree"
        />
        <ActivityIcon
          icon={Puzzle}
          isActive={activePanel === 'palette'}
          onClick={() => onPanelToggle('palette')}
          title="Node Palette"
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Lower: settings + theme */}
      <div className="flex flex-col items-center gap-1">
        <ActivityIcon
          icon={Settings}
          isActive={false}
          onClick={() => {}}
          title="Settings"
          disabled
        />
        <ThemeToggle />
      </div>
    </div>
  )
}
