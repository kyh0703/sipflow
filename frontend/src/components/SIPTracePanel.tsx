import { useCallback, useEffect, useRef, useState } from 'react'
import { Terminal, Power, Trash2, ChevronUp, ChevronDown } from 'lucide-react'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'
import * as SIPServiceBindings from '../../wailsjs/go/handler/SIPService'
import { useSIPStore, type CallState } from '@/stores/sipStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Toggle } from '@/components/ui/toggle'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

interface SIPTraceEntry {
  type: 'trace'
  time: string
  level: string
  message: string
  nodeID?: string
}

interface CallStateEntry {
  type: 'callState'
  time: string
  callState: CallState
}

type PanelEntry = SIPTraceEntry | CallStateEntry

const MAX_ENTRIES = 500

const levelVariant: Record<string, 'destructive' | 'secondary' | 'default' | 'outline'> = {
  ERROR: 'destructive',
  WARN: 'secondary',
  INFO: 'default',
  DEBUG: 'outline',
}

const callStateVariant: Record<string, 'destructive' | 'secondary' | 'default' | 'outline'> = {
  dialing: 'outline',
  ringing: 'secondary',
  progress: 'outline',
  established: 'default',
  terminated: 'secondary',
  failed: 'destructive',
  cancelled: 'secondary',
}

function formatTime(): string {
  const now = new Date()
  return now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  } as Intl.DateTimeFormatOptions)
}

/**
 * SIPTracePanel displays real-time SIP protocol trace messages and call state events.
 * Listens for "sip:trace" and "sip:callState" Wails events from the backend.
 * Collapsible bottom panel with auto-scroll, clear, and trace toggle.
 */
export function SIPTracePanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [traceEnabled, setTraceEnabled] = useState(false)
  const [entries, setEntries] = useState<PanelEntry[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const { initCallStateListener } = useSIPStore((state) => state.actions)

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [entries, isOpen])

  // Listen for sip:trace events
  useEffect(() => {
    const handler = (data: { time: string; level: string; message: string; nodeID?: string }) => {
      setEntries((prev) => {
        const entry: SIPTraceEntry = { type: 'trace', ...data }
        const next = [...prev, entry]
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

  // Listen for sip:callState events and add to combined entries
  useEffect(() => {
    const handler = (data: CallState) => {
      setEntries((prev) => {
        const entry: CallStateEntry = {
          type: 'callState',
          time: formatTime(),
          callState: data,
        }
        const next = [...prev, entry]
        if (next.length > MAX_ENTRIES) {
          return next.slice(next.length - MAX_ENTRIES)
        }
        return next
      })
    }

    EventsOn('sip:callState', handler)
    const cleanupStore = initCallStateListener()

    return () => {
      EventsOff('sip:callState')
      cleanupStore()
    }
  }, [initCallStateListener])

  const handleToggleTrace = useCallback(async (pressed: boolean) => {
    try {
      const response = await SIPServiceBindings.SetSIPTrace(pressed)
      if (response.success) {
        setTraceEnabled(pressed)
      }
    } catch (error) {
      console.error('Failed to toggle SIP trace:', error)
    }
  }, [])

  const handleClear = useCallback(() => {
    setEntries([])
  }, [])

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border-t bg-background">
        {/* Toggle bar */}
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-muted/50 transition-colors cursor-pointer">
            <div className="flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">SIP Trace</span>
              {traceEnabled && (
                <Badge variant="default" className="text-[10px] px-1.5 py-0 h-4">
                  LIVE
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              {entries.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {entries.length}
                </Badge>
              )}
              {isOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Panel content */}
        <CollapsibleContent>
          <Separator />
          {/* Toolbar */}
          <div className="flex items-center gap-1 px-2 py-1 bg-muted/30">
            <Tooltip>
              <TooltipTrigger asChild>
                <Toggle
                  variant="outline"
                  size="sm"
                  pressed={traceEnabled}
                  onPressedChange={handleToggleTrace}
                  className="h-6 px-2 data-[state=on]:bg-green-600 data-[state=on]:text-white"
                >
                  <Power className="w-3 h-3" />
                  <span className="text-[10px]">{traceEnabled ? 'ON' : 'OFF'}</span>
                </Toggle>
              </TooltipTrigger>
              <TooltipContent>Toggle SIP trace capture</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={handleClear}
                >
                  <Trash2 className="w-3 h-3" />
                  <span className="text-[10px]">Clear</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear trace log</TooltipContent>
            </Tooltip>
          </div>

          <Separator />

          {/* Trace output */}
          <ScrollArea className="h-[200px]">
            <div ref={scrollRef} className="font-mono text-xs p-2 bg-muted/10">
              {entries.length === 0 ? (
                <div className="text-muted-foreground text-center py-8">
                  {traceEnabled
                    ? 'Waiting for SIP trace messages...'
                    : 'Enable SIP trace to see protocol messages'}
                </div>
              ) : (
                entries.map((entry, i) => {
                  if (entry.type === 'trace') {
                    return (
                      <div key={i} className="leading-5 hover:bg-muted/30 px-1 rounded-sm">
                        <span className="text-muted-foreground">{entry.time}</span>{' '}
                        <Badge
                          variant={levelVariant[entry.level] || 'outline'}
                          className="text-[9px] px-1 py-0 h-3.5 font-mono"
                        >
                          {entry.level}
                        </Badge>{' '}
                        {entry.nodeID && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-mono">
                            {entry.nodeID}
                          </Badge>
                        )}{' '}
                        <span className="text-foreground">{entry.message}</span>
                      </div>
                    )
                  }
                  // callState entry
                  const cs = entry.callState
                  const detail = cs.statusCode
                    ? `${cs.state} (${cs.statusCode} ${cs.reason || ''})`
                    : cs.error
                      ? `${cs.state} - ${cs.error}`
                      : cs.state
                  return (
                    <div key={i} className="leading-5 hover:bg-muted/30 px-1 rounded-sm">
                      <span className="text-muted-foreground">{entry.time}</span>{' '}
                      <Badge
                        variant={callStateVariant[cs.state] || 'outline'}
                        className={`text-[9px] px-1 py-0 h-3.5 font-mono${
                          cs.state === 'established' ? ' bg-green-600 text-white hover:bg-green-700' : ''
                        }`}
                      >
                        CALL
                      </Badge>{' '}
                      <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-mono">
                        {cs.nodeID}
                      </Badge>{' '}
                      <span className="text-foreground">{detail}</span>
                    </div>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
