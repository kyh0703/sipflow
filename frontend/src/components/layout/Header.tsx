import { PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
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

  // Build title: "ProjectName - FlowName *" or "SIPFlow"
  let title = 'SIPFlow'
  if (projectName) {
    title = projectName
    if (flowName) {
      title += ` - ${flowName}`
    }
    if (isDirty) {
      title += ' *'
    }
  }

  return (
    <header className="fixed top-0 w-full h-14 border-b flex items-center justify-between px-4 z-10 bg-background">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          title="Toggle sidebar"
        >
          <PanelLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-xl font-semibold">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2">
        {connectionState === 'connecting' && (
          <>
            <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
            <span className="text-sm opacity-60">Connecting...</span>
          </>
        )}
        {connectionState === 'connected' && (
          <>
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-sm opacity-60">Connected</span>
          </>
        )}
        {connectionState === 'error' && (
          <>
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-sm text-red-500">Error: {errorMessage}</span>
          </>
        )}
      </div>
    </header>
  )
}
