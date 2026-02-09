import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useScenarioStore } from '../../store/scenario-store';
import type { CommandNode } from '../../types/scenario';

interface CommandPropertiesProps {
  node: CommandNode;
  onUpdate: (data: Partial<CommandNode['data']>) => void;
}

export function CommandProperties({ node, onUpdate }: CommandPropertiesProps) {
  const { data } = node;
  const nodes = useScenarioStore((state) => state.nodes);

  // Filter SIP Instance nodes for instance assignment
  const sipInstanceNodes = nodes.filter((n) => n.type === 'sipInstance');

  return (
    <div className="space-y-4 nodrag">
      {/* Command Type (read-only) */}
      <div className="space-y-2">
        <Label>Command Type</Label>
        <Badge variant="secondary" className="w-fit">
          {data.command}
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
          placeholder="Command label"
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

      <Separator />

      {/* Command-specific fields */}
      {data.command === 'MakeCall' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="targetUri">Target URI</Label>
            <Input
              id="targetUri"
              value={data.targetUri || ''}
              onChange={(e) => onUpdate({ targetUri: e.target.value })}
              placeholder="sip:user@domain"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="timeout">Timeout (ms)</Label>
            <Input
              id="timeout"
              type="number"
              value={data.timeout || 30000}
              onChange={(e) => onUpdate({ timeout: parseInt(e.target.value, 10) })}
            />
          </div>
        </>
      )}

      {data.command === 'Answer' && (
        <div className="space-y-2">
          <Label htmlFor="responseCode">Response Code</Label>
          <Input
            id="responseCode"
            type="number"
            value={200}
            disabled
            className="bg-muted"
          />
        </div>
      )}

      {data.command === 'Release' && (
        <div className="space-y-2">
          <Label htmlFor="cause">Cause</Label>
          <Input
            id="cause"
            value={(data as any).cause || ''}
            onChange={(e) => onUpdate({ cause: e.target.value } as any)}
            placeholder="Normal clearing"
          />
        </div>
      )}
    </div>
  );
}
