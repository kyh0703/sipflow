import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import type { CommandNodeData } from '@/types/nodes'

interface CommandPanelProps {
  data: CommandNodeData
  onChange: (data: CommandNodeData) => void
}

export function CommandPanel({ data, onChange }: CommandPanelProps) {
  const getCommandLabel = (command: string): string => {
    const labels: Record<string, string> = {
      makeCall: 'Make Call',
      bye: 'Bye',
      cancel: 'Cancel',
      hold: 'Hold',
      retrieve: 'Retrieve',
      blindTransfer: 'Blind Transfer',
      muteTransfer: 'Mute Transfer',
      busy: 'Busy',
    }
    return labels[command] || command
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Command Type</Label>
        <div className="px-3 py-2 bg-muted rounded-md text-sm font-medium">
          {getCommandLabel(data.command)}
        </div>
      </div>

      {data.command === 'makeCall' && (
        <div>
          <Label htmlFor="targetUri">Target URI</Label>
          <Input
            id="targetUri"
            type="text"
            placeholder="sip:user@domain"
            value={data.targetUri || ''}
            onChange={(e) =>
              onChange({
                ...data,
                targetUri: e.target.value,
              })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            SIP URI to call (e.g., sip:user@domain)
          </p>
        </div>
      )}

      {(data.command === 'blindTransfer' || data.command === 'muteTransfer') && (
        <div>
          <Label htmlFor="transferTarget">Transfer To</Label>
          <Input
            id="transferTarget"
            type="text"
            placeholder="sip:user@domain"
            value={data.transferTarget || ''}
            onChange={(e) =>
              onChange({
                ...data,
                transferTarget: e.target.value,
              })
            }
          />
          <p className="text-xs text-muted-foreground mt-1">
            Target URI for transfer
          </p>
        </div>
      )}

      {(data.command === 'bye' ||
        data.command === 'cancel' ||
        data.command === 'hold' ||
        data.command === 'retrieve' ||
        data.command === 'busy') && (
        <div className="text-sm text-muted-foreground">
          No additional configuration required for this command.
        </div>
      )}
    </div>
  )
}
