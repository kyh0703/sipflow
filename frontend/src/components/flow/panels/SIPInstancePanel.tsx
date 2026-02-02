import { useEffect } from 'react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useServerStore } from '@/stores/serverStore'
import type { SIPInstanceNodeData } from '@/types/nodes'

interface SIPInstancePanelProps {
  data: SIPInstanceNodeData
  onChange: (data: SIPInstanceNodeData) => void
}

export function SIPInstancePanel({ data, onChange }: SIPInstancePanelProps) {
  const servers = useServerStore((s) => s.servers)
  const { fetchServers } = useServerStore((s) => s.actions)

  // Fetch servers on mount if list is empty
  useEffect(() => {
    if (servers.length === 0) {
      fetchServers()
    }
  }, [servers.length, fetchServers])

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="server">Server</Label>
        <Select
          value={data.server || ''}
          onValueChange={(value) =>
            onChange({
              ...data,
              server: value,
            })
          }
        >
          <SelectTrigger id="server">
            <SelectValue placeholder="Select server" />
          </SelectTrigger>
          <SelectContent>
            {servers.map((server) => (
              <SelectItem key={server.id} value={String(server.id)}>
                {server.name} ({server.address}:{server.port})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="transport">Transport</Label>
        <Select
          value={data.transport || 'UDP'}
          onValueChange={(value) =>
            onChange({
              ...data,
              transport: value as 'UDP' | 'TCP' | 'TLS',
            })
          }
        >
          <SelectTrigger id="transport">
            <SelectValue placeholder="Select transport" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UDP">UDP</SelectItem>
            <SelectItem value="TCP">TCP</SelectItem>
            <SelectItem value="TLS">TLS</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
