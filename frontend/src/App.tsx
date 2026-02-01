import { useEffect, useState } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Header } from './components/layout/Header'
import { LeftSidebar } from './components/flow/LeftSidebar'
import { FlowCanvas } from './components/flow/FlowCanvas'
import { initializeEventHandshake } from './services/eventService'
import { flowService, isSuccess } from './services/flowService'
import './App.css'

type ConnectionState = 'connecting' | 'connected' | 'error'

function App() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    async function initialize() {
      try {
        // Initialize event handshake with backend
        await initializeEventHandshake()
        setConnectionState('connected')

        // Test FlowService by calling listFlows
        const response = await flowService.listFlows()
        if (isSuccess(response)) {
          console.log('FlowService working:', response.data)
          console.log('Flows loaded:', response.data?.length ?? 0)
        } else {
          console.error('FlowService error:', response.error)
        }
      } catch (error) {
        console.error('Failed to initialize:', error)
        setConnectionState('error')
        setErrorMessage(error instanceof Error ? error.message : 'Unknown error')
      }
    }

    initialize()
  }, [])

  return (
    <ReactFlowProvider>
      <div className="h-screen w-screen overflow-hidden flex flex-col">
        <Header
          connectionState={connectionState}
          errorMessage={errorMessage}
        />
        <div className="flex-1 flex mt-14 overflow-hidden">
          <LeftSidebar />
          <FlowCanvas />
        </div>
      </div>
    </ReactFlowProvider>
  )
}

export default App
