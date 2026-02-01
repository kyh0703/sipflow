import { PanelLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useFlowStore } from '@/stores/flowStore'

interface HeaderProps {
  connectionState?: 'connecting' | 'connected' | 'error'
  errorMessage?: string
}

export function Header({ connectionState = 'connecting', errorMessage = '' }: HeaderProps) {
  const { toggleSidebar } = useFlowStore((s) => s.actions)

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
        <h1 className="text-xl font-semibold">SIPFlow</h1>
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
