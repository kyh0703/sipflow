import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useAppSettingsStore, type SIPTransport } from '../store/app-settings-store';

export function SettingsPanel() {
  const pbxHost = useAppSettingsStore((state) => state.pbxHost);
  const pbxPort = useAppSettingsStore((state) => state.pbxPort);
  const pbxDomain = useAppSettingsStore((state) => state.pbxDomain);
  const transport = useAppSettingsStore((state) => state.transport);
  const outboundProxy = useAppSettingsStore((state) => state.outboundProxy);
  const setField = useAppSettingsStore((state) => state.setField);

  return (
    <div className="space-y-4 p-3">
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-foreground">Settings</h4>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="pbxHost">PBX IP / Host</Label>
        <Input
          id="pbxHost"
          value={pbxHost}
          onChange={(e) => setField('pbxHost', e.target.value)}
          placeholder="192.168.0.10"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pbxPort">PBX Port</Label>
        <Input
          id="pbxPort"
          value={pbxPort}
          onChange={(e) => setField('pbxPort', e.target.value.replace(/[^\d]/g, ''))}
          placeholder="5060"
          inputMode="numeric"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="pbxDomain">PBX Domain</Label>
        <Input
          id="pbxDomain"
          value={pbxDomain}
          onChange={(e) => setField('pbxDomain', e.target.value)}
          placeholder="pbx.local"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="transport">Transport</Label>
        <Select value={transport} onValueChange={(value) => setField('transport', value as SIPTransport)}>
          <SelectTrigger id="transport">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="UDP">UDP</SelectItem>
            <SelectItem value="TCP">TCP</SelectItem>
            <SelectItem value="TLS">TLS</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="outboundProxy">Outbound Proxy</Label>
        <Input
          id="outboundProxy"
          value={outboundProxy}
          onChange={(e) => setField('outboundProxy', e.target.value)}
          placeholder="sip:proxy.example.com:5060"
        />
      </div>
    </div>
  );
}
