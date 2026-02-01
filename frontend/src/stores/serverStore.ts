import { create } from 'zustand'

/**
 * SIP Server configuration
 * Represents a pre-registered SIP server that SIP Instance nodes can connect to
 */
export interface SIPServer {
  id: string
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
    addServer: (server: SIPServer) => void
    removeServer: (serverId: string) => void
    updateServer: (serverId: string, updates: Partial<SIPServer>) => void
  }
}

/**
 * Zustand store for SIP server management
 *
 * This store provides mock server data for SIP Instance node configuration.
 * Full server management UI will be implemented in Phase 4 (Settings).
 *
 * Usage:
 * ```tsx
 * const servers = useServerStore(state => state.servers)
 * const addServer = useServerStore(state => state.actions.addServer)
 * ```
 */
export const useServerStore = create<ServerState>((set) => ({
  // Mock server data for development
  servers: [
    {
      id: 'srv-1',
      name: 'Dev Server',
      address: '192.168.1.100',
      port: 5060,
      transport: 'UDP',
    },
    {
      id: 'srv-2',
      name: 'Staging Server',
      address: '10.0.0.50',
      port: 5060,
      transport: 'TCP',
    },
    {
      id: 'srv-3',
      name: 'Production Server',
      address: 'sip.example.com',
      port: 5061,
      transport: 'TLS',
    },
  ],

  actions: {
    addServer: (server) =>
      set((state) => ({
        servers: [...state.servers, server],
      })),

    removeServer: (serverId) =>
      set((state) => ({
        servers: state.servers.filter((s) => s.id !== serverId),
      })),

    updateServer: (serverId, updates) =>
      set((state) => ({
        servers: state.servers.map((s) =>
          s.id === serverId ? { ...s, ...updates } : s
        ),
      })),
  },
}))
