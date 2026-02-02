import { useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Header } from './components/layout/Header'
import { LeftSidebar } from './components/flow/LeftSidebar'
import { FlowCanvas } from './components/flow/FlowCanvas'
import { PropertyPanel } from './components/flow/PropertyPanel'
import { initializeEventHandshake } from './services/eventService'
import { EventsOn, EventsOff } from '../wailsjs/runtime/runtime'
import { useProjectStore } from './stores/projectStore'
import { useFlowStore } from './stores/flowStore'
import { useFlowPersistence } from './hooks/useFlowPersistence'
import './App.css'

type ConnectionState = 'connecting' | 'connected' | 'error'

/**
 * Inner app component that can use useReactFlow (inside ReactFlowProvider)
 */
function AppContent() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const { saveCurrentFlow } = useFlowPersistence()
  const projectActions = useProjectStore((s) => s.actions)
  const flowActions = useFlowStore((s) => s.actions)

  useEffect(() => {
    async function initialize() {
      try {
        await initializeEventHandshake()
        setConnectionState('connected')
      } catch (error) {
        console.error('Failed to initialize:', error)
        setConnectionState('error')
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error')
      }
    }

    initialize()
  }, [])

  // Listen for project lifecycle events from backend
  useEffect(() => {
    const handleProjectOpened = (data: { path: string }) => {
      projectActions.setProjectPath(data.path)
      projectActions.refreshFlowList()
      projectActions.setCurrentFlowId(null)
      projectActions.markClean()
      flowActions.setNodes([])
      flowActions.setEdges([])
    }

    const handleProjectCreated = (data: { path: string }) => {
      projectActions.setProjectPath(data.path)
      projectActions.setFlows([])
      projectActions.setCurrentFlowId(null)
      projectActions.markClean()
      flowActions.setNodes([])
      flowActions.setEdges([])
    }

    const handleProjectClosed = () => {
      projectActions.reset()
      flowActions.setNodes([])
      flowActions.setEdges([])
    }

    const handleMenuSave = () => {
      saveCurrentFlow()
    }

    EventsOn('project:opened', handleProjectOpened)
    EventsOn('project:created', handleProjectCreated)
    EventsOn('project:closed', handleProjectClosed)
    EventsOn('menu:save', handleMenuSave)

    return () => {
      EventsOff('project:opened')
      EventsOff('project:created')
      EventsOff('project:closed')
      EventsOff('menu:save')
    }
  }, [projectActions, flowActions, saveCurrentFlow])

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col">
      <Header
        connectionState={connectionState}
        errorMessage={errorMessage}
      />
      <div className="flex-1 flex mt-14 overflow-hidden">
        <LeftSidebar />
        <FlowCanvas />
      </div>
      <PropertyPanel />
    </div>
  )
}

function App() {
  return (
    <ReactFlowProvider>
      <AppContent />
    </ReactFlowProvider>
  )
}

export default App
