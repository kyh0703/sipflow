import { useEffect, useState } from 'react'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
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
    <div className="h-screen w-screen overflow-hidden">
      <Header />
      <Sidebar />
      <main className="ml-64 mt-14 h-[calc(100vh-3.5rem)] w-[calc(100vw-16rem)] flex flex-col items-center justify-center gap-4">
        <p className="opacity-60">Flow Canvas (Phase 2)</p>

        {/* Connection status indicator */}
        <div className="flex items-center gap-2">
          {connectionState === 'connecting' && (
            <>
              <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-sm opacity-60">Connecting to backend...</span>
            </>
          )}
          {connectionState === 'connected' && (
            <>
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm opacity-60">Backend connected</span>
            </>
          )}
          {connectionState === 'error' && (
            <>
              <div className="h-2 w-2 rounded-full bg-red-500" />
              <span className="text-sm text-red-500">
                Connection failed: {errorMessage}
              </span>
            </>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
