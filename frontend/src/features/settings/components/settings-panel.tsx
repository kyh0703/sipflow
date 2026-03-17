import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { showConfirmModal } from '@/components/modal/confirm-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  useAppSettingsActions,
  usePbxInstances,
  type PbxInstanceSettings,
  type SIPTransport,
} from '../store/app-settings-store';

export function SettingsPanel() {
  const pbxInstances = usePbxInstances();
  const { addPbxInstance, updatePbxInstance, removePbxInstance } = useAppSettingsActions();

  const handleAddInstance = () => {
    addPbxInstance();
    toast.success('새 PBX 인스턴스를 추가했습니다.');
  };

  const handleRemoveInstance = async (instance: PbxInstanceSettings) => {
    const confirmed = await showConfirmModal(
      `"${instance.name || 'Unnamed PBX'}" 인스턴스를 삭제할까요?`
    );

    if (!confirmed) {
      return;
    }

    removePbxInstance(instance.id);
    toast.success('PBX 인스턴스를 삭제했습니다.');
  };

  const handleTransportChange = (instanceId: string, value: string) => {
    updatePbxInstance(instanceId, { transport: value as SIPTransport });
  };

  return (
    <div className="space-y-6 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-foreground">PBX 인스턴스</h3>
          <p className="text-sm text-muted-foreground">
            SIP Instance 노드가 참조할 PBX 연결 정보를 그리드에서 바로 편집하세요.
          </p>
        </div>
        <Button type="button" variant="outline" onClick={handleAddInstance}>
          <Plus className="h-4 w-4" />
          행 추가
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Port</TableHead>
              <TableHead>Transport</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="w-[56px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {pbxInstances.length > 0 ? (
              pbxInstances.map((instance) => (
                <TableRow key={instance.id}>
                  <TableCell>
                    <Input
                      value={instance.name}
                      onChange={(event) =>
                        updatePbxInstance(instance.id, { name: event.target.value })
                      }
                      placeholder="HQ PBX"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={instance.host}
                      onChange={(event) =>
                        updatePbxInstance(instance.id, { host: event.target.value })
                      }
                      placeholder="192.168.0.10"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={instance.port}
                      onChange={(event) =>
                        updatePbxInstance(instance.id, {
                          port: event.target.value.replace(/[^\d]/g, ''),
                        })
                      }
                      placeholder="5060"
                      inputMode="numeric"
                    />
                  </TableCell>
                  <TableCell>
                    <Select
                      value={instance.transport}
                      onValueChange={(value) => handleTransportChange(instance.id, value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UDP">UDP</SelectItem>
                        <SelectItem value="TCP">TCP</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      value={instance.registerInterval}
                      onChange={(event) =>
                        updatePbxInstance(instance.id, {
                          registerInterval: event.target.value.replace(/[^\d]/g, ''),
                        })
                      }
                      placeholder="300"
                      inputMode="numeric"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      onClick={() => handleRemoveInstance(instance)}
                      aria-label="Delete PBX instance"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={6} className="h-28 text-center text-sm text-muted-foreground">
                  아직 등록된 PBX 인스턴스가 없습니다. 우측 상단의 "행 추가" 버튼으로 시작하세요.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
