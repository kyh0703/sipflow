import { create } from 'zustand'
import { EventsOn, EventsOff } from '../../wailsjs/runtime/runtime'

/**
 * Represents a SIP call state event from the backend.
 * Emitted via "sip:callState" Wails event from MakeCall/Bye/Cancel goroutines.
 */
export interface CallState {
  callID: string
  nodeID: string
  state:
    | 'dialing'
    | 'ringing'
    | 'progress'
    | 'established'
    | 'terminated'
    | 'failed'
    | 'cancelled'
  statusCode?: number
  reason?: string
  error?: string
}

interface SIPState {
  activeCalls: Record<string, CallState> // callID -> state
  callHistory: CallState[] // recent completed calls

  actions: {
    updateCallState: (event: CallState) => void
    clearHistory: () => void
    initCallStateListener: () => () => void // returns cleanup function
  }
}

const MAX_HISTORY = 100

const TERMINAL_STATES = new Set(['terminated', 'failed', 'cancelled'])

/**
 * Zustand store for SIP call state tracking.
 *
 * Listens for "sip:callState" Wails events from the backend and maintains
 * active calls and call history.
 *
 * Usage:
 * ```tsx
 * const activeCalls = useSIPStore(state => state.activeCalls)
 * const { initCallStateListener } = useSIPStore(state => state.actions)
 *
 * useEffect(() => {
 *   const cleanup = initCallStateListener()
 *   return cleanup
 * }, [])
 * ```
 */
export const useSIPStore = create<SIPState>((set) => ({
  activeCalls: {},
  callHistory: [],

  actions: {
    updateCallState: (event: CallState) => {
      set((state) => {
        if (TERMINAL_STATES.has(event.state)) {
          // Move to history, remove from active
          const { [event.callID]: _, ...remaining } = state.activeCalls
          const history = [event, ...state.callHistory].slice(0, MAX_HISTORY)
          return { activeCalls: remaining, callHistory: history }
        }
        // Update active call
        return {
          activeCalls: { ...state.activeCalls, [event.callID]: event },
        }
      })
    },

    clearHistory: () => set({ callHistory: [] }),

    initCallStateListener: () => {
      const handler = (data: CallState) => {
        useSIPStore.getState().actions.updateCallState(data)
      }
      EventsOn('sip:callState', handler)
      return () => {
        EventsOff('sip:callState')
      }
    },
  },
}))
