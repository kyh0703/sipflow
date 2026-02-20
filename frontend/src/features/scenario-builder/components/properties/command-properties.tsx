import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useScenarioStore } from '../../store/scenario-store';
import type { CommandNode } from '../../types/scenario';
import { SelectWAVFile } from '../../../../../wailsjs/go/binding/MediaBinding';

interface CommandPropertiesProps {
  node: CommandNode;
  onUpdate: (data: Partial<CommandNode['data']>) => void;
}

export function CommandProperties({ node, onUpdate }: CommandPropertiesProps) {
  const { data } = node;
  const nodes = useScenarioStore((state) => state.nodes);
  const [isSelecting, setIsSelecting] = useState(false);

  // Filter SIP Instance nodes for instance assignment
  const sipInstanceNodes = nodes.filter((n) => n.type === 'sipInstance');

  const handleSelectAudioFile = async () => {
    setIsSelecting(true);
    try {
      const filePath = await SelectWAVFile();
      if (!filePath) return;
      onUpdate({ filePath });
      toast.success('Audio file selected');
    } catch (err: any) {
      toast.error(`Invalid WAV file: ${err?.message || err}`);
    } finally {
      setIsSelecting(false);
    }
  };

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

      {data.command === 'PlayAudio' && (
        <div className="space-y-2">
          <Label>Audio File</Label>
          {data.filePath ? (
            <div className="flex items-center gap-2">
              <Badge variant="outline" title={data.filePath} className="max-w-[200px] truncate">
                {data.filePath.split(/[\\/]/).pop()}
              </Badge>
              <Button size="sm" variant="ghost" onClick={handleSelectAudioFile} disabled={isSelecting}>
                Change
              </Button>
            </div>
          ) : (
            <Button onClick={handleSelectAudioFile} disabled={isSelecting} size="sm">
              {isSelecting ? 'Selecting...' : 'Select File'}
            </Button>
          )}
          <p className="text-xs text-muted-foreground">Required: 8kHz mono PCM WAV format</p>
        </div>
      )}

      {data.command === 'SendDTMF' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="digits">Digits</Label>
            <Input
              id="digits"
              value={data.digits || ''}
              onChange={(e) => {
                // 유효한 DTMF 문자만 허용: 0-9, *, #, A-D
                const filtered = e.target.value.replace(/[^0-9*#A-Da-d]/g, '').toUpperCase();
                onUpdate({ digits: filtered });
              }}
              placeholder="1234*#"
              maxLength={20}
            />
            <p className="text-xs text-muted-foreground">
              Valid: 0-9, *, #, A-D (max 20 digits)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="intervalMs">Interval Between Digits (ms)</Label>
            <Input
              id="intervalMs"
              type="number"
              value={data.intervalMs ?? 100}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 100;
                onUpdate({ intervalMs: Math.max(50, Math.min(1000, val)) });
              }}
              min={50}
              max={1000}
              step={10}
            />
            <p className="text-xs text-muted-foreground">
              Delay between each digit (min: 50ms, default: 100ms)
            </p>
          </div>
        </>
      )}

      {data.command === 'BlindTransfer' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="targetUser">Target User</Label>
            <Input
              id="targetUser"
              value={data.targetUser || ''}
              onChange={(e) => onUpdate({ targetUser: e.target.value })}
              placeholder="carol"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetHost">Target Host</Label>
            <Input
              id="targetHost"
              value={data.targetHost || ''}
              onChange={(e) => onUpdate({ targetHost: e.target.value })}
              placeholder="192.168.1.100:5060"
            />
            <p className="text-xs text-muted-foreground">
              host:port (e.g. 192.168.1.100:5060)
            </p>
          </div>
        </>
      )}
    </div>
  );
}
