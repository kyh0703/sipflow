import { PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useFlowStore } from '@/stores/flowStore'
import { useProjectStore } from '@/stores/projectStore'

interface HeaderProps {
  connectionState?: 'connecting' | 'connected' | 'error'
  errorMessage?: string
}

/**
 * Extract display name from project file path.
 * Removes directory path and .sipflow extension.
 */
function getProjectDisplayName(path: string | null): string | null {
  if (!path) return null
  const filename = path.split('/').pop()?.split('\\').pop() || path
  return filename.replace(/\.sipflow$/i, '')
}

export function Header({ connectionState = 'connecting', errorMessage = '' }: HeaderProps) {
  const { toggleSidebar } = useFlowStore((s) => s.actions)
  const projectPath = useProjectStore((s) => s.projectPath)
  const currentFlowId = useProjectStore((s) => s.currentFlowId)
  const flows = useProjectStore((s) => s.flows)
  const isDirty = useProjectStore((s) => s.isDirty)

  const projectName = getProjectDisplayName(projectPath)
  const currentFlow = flows.find((f) => f.id === currentFlowId)
  const flowName = currentFlow?.name

  // Build title: "ProjectName - FlowName" or "SIPFlow"
  let title = 'SIPFlow'
  if (projectName) {
    title = projectName
    if (flowName) {
      title += ` - ${flowName}`
    }
  }

  return (
    <header className="fixed top-0 w-full h-14 border-b flex items-center justify-between px-4 z-10 bg-background">
      <div className="flex items-center gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
            >
              <PanelLeft className="w-5 h-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Toggle sidebar</TooltipContent>
        </Tooltip>

        <Separator orientation="vertical" className="h-6" />

        <h1 className="text-sm font-semibold">
          {title}
        </h1>

        {isDirty && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
            Unsaved
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {connectionState === 'connecting' && (
          <Badge variant="outline" className="gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-[10px]">Connecting</span>
          </Badge>
        )}
        {connectionState === 'connected' && (
          <Badge variant="outline" className="gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
            <span className="text-[10px]">Connected</span>
          </Badge>
        )}
        {connectionState === 'error' && (
          <Badge variant="destructive" className="gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-white" />
            <span className="text-[10px]">Error: {errorMessage}</span>
          </Badge>
        )}
      </div>
    </header>
  )
}
