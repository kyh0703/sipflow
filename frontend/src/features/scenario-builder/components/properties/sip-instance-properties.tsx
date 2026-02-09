import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import type { SipInstanceNode } from '../../types/scenario';
import { INSTANCE_COLORS } from '../../types/scenario';

interface SipInstancePropertiesProps {
  node: SipInstanceNode;
  onUpdate: (data: Partial<SipInstanceNode['data']>) => void;
}

export function SipInstanceProperties({ node, onUpdate }: SipInstancePropertiesProps) {
  const { data } = node;

  const handleModeChange = (mode: 'DN' | 'Endpoint') => {
    onUpdate({
      mode,
      register: mode === 'DN',
    });
  };

  return (
    <div className="space-y-4 nodrag">
      {/* Label */}
      <div className="space-y-2">
        <Label htmlFor="label">Label</Label>
        <Input
          id="label"
          value={data.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          placeholder="SIP Instance name"
        />
      </div>

      <Separator />

      {/* Mode */}
      <div className="space-y-2">
        <Label htmlFor="mode">Mode</Label>
        <Select value={data.mode} onValueChange={handleModeChange}>
          <SelectTrigger id="mode">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="DN">DN</SelectItem>
            <SelectItem value="Endpoint">Endpoint</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* DN Number - visible only for DN mode */}
      {data.mode === 'DN' && (
        <div className="space-y-2">
          <Label htmlFor="dn">DN Number</Label>
          <Input
            id="dn"
            value={data.dn || ''}
            onChange={(e) => onUpdate({ dn: e.target.value })}
            placeholder="e.g., 1001"
          />
        </div>
      )}

      {/* SIP Server - visible only for Endpoint mode */}
      {data.mode === 'Endpoint' && (
        <div className="space-y-2">
          <Label htmlFor="serverId">SIP Server</Label>
          <Input
            id="serverId"
            value={data.serverId || ''}
            onChange={(e) => onUpdate({ serverId: e.target.value })}
            placeholder="sip:server:5060"
          />
        </div>
      )}

      {/* Register */}
      <div className="flex items-center justify-between">
        <Label htmlFor="register">Register</Label>
        <Switch
          id="register"
          checked={data.register}
          onCheckedChange={(checked) => onUpdate({ register: checked })}
        />
      </div>

      <Separator />

      {/* Color Picker */}
      <div className="space-y-2">
        <Label>Color</Label>
        <div className="flex gap-2">
          {INSTANCE_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
              style={{
                backgroundColor: color,
                borderColor: data.color === color ? '#000' : 'transparent',
              }}
              onClick={() => onUpdate({ color })}
              aria-label={`Select color ${color}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
