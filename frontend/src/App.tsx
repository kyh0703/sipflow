import { useEffect } from 'react'
import { Header } from './components/layout/Header'
import { Sidebar } from './components/layout/Sidebar'
import './App.css'

function App() {
  useEffect(() => {
    // Event handshake will be initialized here in Task 2
    // initializeEventHandshake()
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden">
      <Header />
      <Sidebar />
      <main className="ml-64 mt-14 h-[calc(100vh-3.5rem)] w-[calc(100vw-16rem)] flex items-center justify-center">
        <p className="opacity-60">Flow Canvas (Phase 2)</p>
      </main>
    </div>
  )
}

export default App
