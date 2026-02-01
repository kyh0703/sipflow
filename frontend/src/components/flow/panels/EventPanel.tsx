import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EventNodeData } from '@/types/nodes'

interface EventPanelProps {
  data: EventNodeData
  onChange: (data: EventNodeData) => void
}

export function EventPanel({ data, onChange }: EventPanelProps) {
  const eventTypes = [
    { value: 'incomingCall', label: 'Incoming Call' },
    { value: 'callAnswered', label: 'Call Answered' },
    { value: 'callEnded', label: 'Call Ended' },
    { value: 'callFailed', label: 'Call Failed' },
    { value: 'transferComplete', label: 'Transfer Complete' },
  ]

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="eventType">Event Type</Label>
        <Select
          value={data.eventType || 'wait'}
          onValueChange={(value) =>
            onChange({
              ...data,
              eventType: value as 'wait',
            })
          }
        >
          <SelectTrigger id="eventType">
            <SelectValue placeholder="Select event type" />
          </SelectTrigger>
          <SelectContent>
            {eventTypes.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="timeout">Timeout (seconds)</Label>
        <Input
          id="timeout"
          type="number"
          min="0"
          placeholder="30"
          value={data.timeout ? String(data.timeout / 1000) : '30'}
          onChange={(e) => {
            const seconds = parseInt(e.target.value) || 30
            onChange({
              ...data,
              timeout: seconds * 1000,
            })
          }}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Maximum time to wait for event (default: 30 seconds)
        </p>
      </div>
    </div>
  )
}
