import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import type { SipInstanceNode } from '../../types/scenario';
import { DEFAULT_CODECS } from '../../types/scenario';
import { CodecListItem } from './codec-list-item';
import { usePbxInstances, type PbxInstanceSettings } from '../../store/app-settings-store';

interface SipInstancePropertiesProps {
  node: SipInstanceNode;
  onUpdate: (data: Partial<SipInstanceNode['data']>) => void;
}

function getPbxInstanceLabel(instance: PbxInstanceSettings) {
  if (instance.name.trim()) {
    return instance.name;
  }

  if (instance.host.trim()) {
    return `${instance.host}:${instance.port || '5060'}`;
  }

  return 'Unnamed PBX';
}

export function SipInstanceProperties({ node, onUpdate }: SipInstancePropertiesProps) {
  const { data } = node;
  const pbxInstances = usePbxInstances();
  const numberValue =
    data.dn || (data.label && data.label !== 'SIP Instance' ? data.label : '');
  const selectedPbxInstanceId = data.pbxInstanceId || data.serverId || 'none';

  const handleModeChange = (mode: 'DN' | 'Endpoint') => {
    onUpdate({
      mode,
      register: mode === 'DN',
    });
  };

  const moveCodec = (fromIndex: number, toIndex: number) => {
    const currentCodecs = data.codecs && data.codecs.length > 0
      ? data.codecs
      : [...DEFAULT_CODECS];
    const newCodecs = [...currentCodecs];
    const [removed] = newCodecs.splice(fromIndex, 1);
    newCodecs.splice(toIndex, 0, removed);
    onUpdate({ codecs: newCodecs });
  };

  const displayCodecs = data.codecs && data.codecs.length > 0 ? data.codecs : DEFAULT_CODECS;

  return (
    <div className="space-y-4 nodrag">
      <section className="space-y-3">
        <div className="space-y-1">
          <h4 className="text-base font-semibold text-foreground">기본 정보</h4>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dn">Number</Label>
          <Input
            id="dn"
            value={numberValue}
            onChange={(e) => {
              const value = e.target.value;
              onUpdate({ dn: value, label: value });
            }}
            placeholder="4300"
          />
        </div>

        <Separator />

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

        <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-2">
          <div className="space-y-1">
            <Label htmlFor="register-enabled">Register</Label>
            <p className="text-xs text-muted-foreground">
              Enable SIP REGISTER for this instance when the scenario starts.
            </p>
          </div>
          <Switch
            id="register-enabled"
            checked={Boolean(data.register)}
            onCheckedChange={(checked) => onUpdate({ register: checked })}
          />
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <div className="space-y-1">
          <h4 className="text-base font-semibold text-foreground">연결 설정</h4>
        </div>

        <div className="space-y-2">
          <Label htmlFor="pbxInstanceId">PBX Instance</Label>
          <Select
            value={selectedPbxInstanceId}
            onValueChange={(value) =>
              onUpdate({
                pbxInstanceId: value === 'none' ? undefined : value,
                serverId: value === 'none' ? undefined : value,
              })
            }
          >
            <SelectTrigger id="pbxInstanceId">
              <SelectValue placeholder="Select PBX instance..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {pbxInstances.map((instance) => (
                <SelectItem key={instance.id} value={instance.id}>
                  {getPbxInstanceLabel(instance)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {pbxInstances.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Settings에서 PBX 인스턴스를 먼저 추가해 주세요.
            </p>
          )}
        </div>
      </section>

      <Separator />

      <section className="space-y-3">
        <div className="space-y-1">
          <h4 className="text-base font-semibold text-foreground">코덱 우선순위</h4>
        </div>

        <div className="space-y-2">
          <Label>Preferred Codecs</Label>
          <p className="text-xs text-muted-foreground">Drag to reorder priority.</p>
          <div className="space-y-2">
            {displayCodecs.map((codec, index) => (
              <CodecListItem
                key={codec}
                codec={codec}
                index={index}
                onMove={moveCodec}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
