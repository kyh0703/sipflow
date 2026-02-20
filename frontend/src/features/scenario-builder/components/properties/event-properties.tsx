import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useScenarioStore } from '../../store/scenario-store';
import type { EventNode } from '../../types/scenario';

interface EventPropertiesProps {
  node: EventNode;
  onUpdate: (data: Partial<EventNode['data']>) => void;
}

export function EventProperties({ node, onUpdate }: EventPropertiesProps) {
  const { data } = node;
  const nodes = useScenarioStore((state) => state.nodes);

  // Filter SIP Instance nodes for instance assignment
  const sipInstanceNodes = nodes.filter((n) => n.type === 'sipInstance');

  return (
    <div className="space-y-4 nodrag">
      {/* Event Type (read-only) */}
      <div className="space-y-2">
        <Label>Event Type</Label>
        <Badge variant="secondary" className="w-fit">
          {data.event}
        </Badge>
      </div>

      <Separator />

      {/* Label */}
      <div className="space-y-2">
        <Label htmlFor="label">Label</Label>
        <Input
          id="label"
          value={data.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="Event label"
        />
      </div>

      {/* SIP Instance Assignment */}
      <div className="space-y-2">
        <Label htmlFor="sipInstance">SIP Instance</Label>
        <Select
          value={data.sipInstanceId || 'none'}
          onValueChange={(value) => onUpdate({ sipInstanceId: value === 'none' ? undefined : value })}
        >
          <SelectTrigger id="sipInstance">
            <SelectValue placeholder="Select instance..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {sipInstanceNodes.map((instance) => (
              <SelectItem key={instance.id} value={instance.id}>
                {String(instance.data.label || instance.id)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timeout - only visible for TIMEOUT event */}
      {data.event === 'TIMEOUT' && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="timeout">Timeout (ms)</Label>
            <Input
              id="timeout"
              type="number"
              value={data.timeout || 5000}
              onChange={(e) => onUpdate({ timeout: parseInt(e.target.value, 10) })}
            />
          </div>
        </>
      )}

      {/* DTMFReceived - expectedDigit and timeout */}
      {data.event === 'DTMFReceived' && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="expectedDigit">Expected Digit (optional)</Label>
            <Input
              id="expectedDigit"
              value={data.expectedDigit || ''}
              onChange={(e) => {
                // 단일 유효 DTMF 문자만 허용
                const filtered = e.target.value.replace(/[^0-9*#A-Da-d]/g, '').toUpperCase().slice(0, 1);
                onUpdate({ expectedDigit: filtered });
              }}
              placeholder="Leave empty to accept any digit"
              maxLength={1}
            />
            <p className="text-xs text-muted-foreground">
              If set, waits for this specific digit. Empty accepts any.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeout">Timeout (ms)</Label>
            <Input
              id="timeout"
              type="number"
              value={data.timeout ?? 10000}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 10000;
                onUpdate({ timeout: Math.max(1000, Math.min(60000, val)) });
              }}
              min={1000}
              max={60000}
              step={1000}
            />
            <p className="text-xs text-muted-foreground">
              Maximum wait time for DTMF digit (default: 10000ms)
            </p>
          </div>
        </>
      )}

      {/* HELD/RETRIEVED/TRANSFERRED - timeout */}
      {(data.event === 'HELD' || data.event === 'RETRIEVED' || data.event === 'TRANSFERRED') && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="timeout">Timeout (ms)</Label>
            <Input
              id="timeout"
              type="number"
              value={data.timeout ?? 10000}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 10000;
                onUpdate({ timeout: Math.max(1000, Math.min(60000, val)) });
              }}
              min={1000}
              max={60000}
              step={1000}
            />
            <p className="text-xs text-muted-foreground">
              Maximum wait time for SIP event (default: 10000ms)
            </p>
          </div>
        </>
      )}
    </div>
  );
}
