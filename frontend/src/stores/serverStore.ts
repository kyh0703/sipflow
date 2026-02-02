import { create } from 'zustand'
import * as SIPServiceBindings from '../../wailsjs/go/handler/SIPService'
import type { handler } from '../../wailsjs/go/models'

/**
 * SIP Server configuration
 * Represents a pre-registered SIP server that SIP Instance nodes can connect to
 */
export interface SIPServer {
  id: number
  name: string
  address: string
  port: number
  transport: 'UDP' | 'TCP' | 'TLS'
}

/**
 * Server store state interface
 */
interface ServerState {
  servers: SIPServer[]

  // Actions grouped in object to keep references stable
  actions: {
    fetchServers: () => Promise<void>
    createServer: (req: handler.CreateServerRequest) => Promise<number | null>
    updateServer: (req: handler.UpdateServerRequest) => Promise<boolean>
    deleteServer: (id: number) => Promise<boolean>
    reset: () => void
  }
}

/**
 * Convert SIPServerMeta from backend to frontend SIPServer
 */
function toSIPServer(meta: handler.SIPServerMeta): SIPServer {
  return {
    id: meta.id,
    name: meta.name,
    address: meta.address,
    port: meta.port,
    transport: meta.transport as 'UDP' | 'TCP' | 'TLS',
  }
}

/**
 * Zustand store for SIP server management
 *
 * Connects to backend SIPService via Wails bindings.
 * Servers are persisted in the project SQLite database.
 *
 * Usage:
 * ```tsx
 * const servers = useServerStore(state => state.servers)
 * const { fetchServers } = useServerStore(state => state.actions)
 * ```
 */
export const useServerStore = create<ServerState>((set) => ({
  servers: [],

  actions: {
    fetchServers: async () => {
      try {
        const response = await SIPServiceBindings.ListServers()
        if (response.success && response.data) {
          set({ servers: response.data.map(toSIPServer) })
        }
      } catch (error) {
        console.error('Failed to fetch servers:', error)
      }
    },

    createServer: async (req: handler.CreateServerRequest) => {
      try {
        const response = await SIPServiceBindings.CreateServer(req)
        if (response.success && response.data) {
          // Re-fetch list to get consistent state
          await useServerStore.getState().actions.fetchServers()
          return response.data.id ?? null
        }
        console.error('Failed to create server:', response.error?.message)
        return null
      } catch (error) {
        console.error('Failed to create server:', error)
        return null
      }
    },

    updateServer: async (req: handler.UpdateServerRequest) => {
      try {
        const response = await SIPServiceBindings.UpdateServer(req)
        if (response.success) {
          await useServerStore.getState().actions.fetchServers()
          return true
        }
        console.error('Failed to update server:', response.error?.message)
        return false
      } catch (error) {
        console.error('Failed to update server:', error)
        return false
      }
    },

    deleteServer: async (id: number) => {
      try {
        const response = await SIPServiceBindings.DeleteServer(id)
        if (response.success) {
          await useServerStore.getState().actions.fetchServers()
          return true
        }
        console.error('Failed to delete server:', response.error?.message)
        return false
      } catch (error) {
        console.error('Failed to delete server:', error)
        return false
      }
    },

    reset: () => set({ servers: [] }),
  },
}))
