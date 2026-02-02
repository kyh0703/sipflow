import { useCallback, useEffect, useRef, useState } from 'react'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'
import * as SIPServiceBindings from '../../wailsjs/go/handler/SIPService'

interface SIPTraceEntry {
  time: string
  level: string
  message: string
  nodeID?: string
}

const MAX_ENTRIES = 500

/**
 * SIPTracePanel displays real-time SIP protocol trace messages.
 * Listens for "sip:trace" Wails events from the backend SIPTraceHandler.
 * Collapsible bottom panel with auto-scroll, clear, and trace toggle.
 */
export function SIPTracePanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [traceEnabled, setTraceEnabled] = useState(false)
  const [entries, setEntries] = useState<SIPTraceEntry[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries, isOpen])

  // Listen for sip:trace events
  useEffect(() => {
    const handler = (data: SIPTraceEntry) => {
      setEntries((prev) => {
        const next = [...prev, data]
        if (next.length > MAX_ENTRIES) {
          return next.slice(next.length - MAX_ENTRIES)
        }
        return next
      })
    }

    EventsOn('sip:trace', handler)
    return () => {
      EventsOff('sip:trace')
    }
  }, [])

  const handleToggleTrace = useCallback(async () => {
    const newValue = !traceEnabled
    try {
      const response = await SIPServiceBindings.SetSIPTrace(newValue)
      if (response.success) {
        setTraceEnabled(newValue)
      }
    } catch (error) {
      console.error('Failed to toggle SIP trace:', error)
    }
  }, [traceEnabled])

  const handleClear = useCallback(() => {
    setEntries([])
  }, [])

  const getLevelColor = (level: string): string => {
    switch (level) {
      case 'ERROR':
        return 'text-red-400'
      case 'WARN':
        return 'text-yellow-400'
      case 'INFO':
        return 'text-green-400'
      case 'DEBUG':
        return 'text-gray-400'
      default:
        return 'text-green-400'
    }
  }

  return (
    <div className="border-t border-gray-700">
      {/* Toggle bar */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-1.5 bg-gray-800 text-gray-300 text-xs hover:bg-gray-750 cursor-pointer"
      >
        <span className="font-medium">SIP Trace</span>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <span className="text-gray-500">{entries.length} messages</span>
          )}
          <span>{isOpen ? '\u25BC' : '\u25B2'}</span>
        </div>
      </button>

      {/* Panel content */}
      {isOpen && (
        <div className="bg-gray-900">
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 py-1 border-b border-gray-700">
            <button
              onClick={handleToggleTrace}
              className={`px-2 py-0.5 text-xs rounded ${
                traceEnabled
                  ? 'bg-green-700 text-green-100'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              {traceEnabled ? 'Trace ON' : 'Trace OFF'}
            </button>
            <button
              onClick={handleClear}
              className="px-2 py-0.5 text-xs rounded bg-gray-700 text-gray-300 hover:bg-gray-600"
            >
              Clear
            </button>
          </div>

          {/* Trace output */}
          <div
            ref={scrollRef}
            className="h-[200px] overflow-y-auto font-mono text-xs p-2"
          >
            {entries.length === 0 ? (
              <div className="text-gray-600 text-center py-4">
                {traceEnabled
                  ? 'Waiting for SIP trace messages...'
                  : 'Enable SIP trace to see protocol messages'}
              </div>
            ) : (
              entries.map((entry, i) => (
                <div key={i} className="leading-5">
                  <span className="text-gray-500">{entry.time}</span>{' '}
                  <span className={getLevelColor(entry.level)}>
                    [{entry.level}]
                  </span>{' '}
                  {entry.nodeID && (
                    <span className="text-blue-400">[{entry.nodeID}]</span>
                  )}{' '}
                  <span className="text-green-400">{entry.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
