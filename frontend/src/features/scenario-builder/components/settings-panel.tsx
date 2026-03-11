import { useMemo } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
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

const columnHelper = createColumnHelper<PbxInstanceSettings>();

export function SettingsPanel() {
  const pbxInstances = usePbxInstances();
  const { addPbxInstance, updatePbxInstance, removePbxInstance } = useAppSettingsActions();

  const columns = useMemo(
    () => [
      columnHelper.accessor('name', {
        header: 'Name',
        cell: ({ row, getValue }) => (
          <Input
            value={getValue()}
            onChange={(event) =>
              updatePbxInstance(row.original.id, { name: event.target.value })
            }
            placeholder="HQ PBX"
          />
        ),
      }),
      columnHelper.accessor('host', {
        header: 'Host',
        cell: ({ row, getValue }) => (
          <Input
            value={getValue()}
            onChange={(event) =>
              updatePbxInstance(row.original.id, { host: event.target.value })
            }
            placeholder="192.168.0.10"
          />
        ),
      }),
      columnHelper.accessor('port', {
        header: 'Port',
        cell: ({ row, getValue }) => (
          <Input
            value={getValue()}
            onChange={(event) =>
              updatePbxInstance(row.original.id, {
                port: event.target.value.replace(/[^\d]/g, ''),
              })
            }
            placeholder="5060"
            inputMode="numeric"
          />
        ),
      }),
      columnHelper.accessor('domain', {
        header: 'Domain',
        cell: ({ row, getValue }) => (
          <Input
            value={getValue()}
            onChange={(event) =>
              updatePbxInstance(row.original.id, { domain: event.target.value })
            }
            placeholder="pbx.local"
          />
        ),
      }),
      columnHelper.accessor('transport', {
        header: 'Transport',
        cell: ({ row, getValue }) => (
          <Select
            value={getValue()}
            onValueChange={(value) =>
              updatePbxInstance(row.original.id, { transport: value as SIPTransport })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UDP">UDP</SelectItem>
              <SelectItem value="TCP">TCP</SelectItem>
              <SelectItem value="TLS">TLS</SelectItem>
            </SelectContent>
          </Select>
        ),
      }),
      columnHelper.accessor('outboundProxy', {
        header: 'Outbound Proxy',
        cell: ({ row, getValue }) => (
          <Input
            value={getValue()}
            onChange={(event) =>
              updatePbxInstance(row.original.id, {
                outboundProxy: event.target.value,
              })
            }
            placeholder="sip:proxy.example.com:5060"
          />
        ),
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              const confirmed = window.confirm(
                `\"${row.original.name || 'Unnamed PBX'}\" 인스턴스를 삭제할까요?`
              );
              if (!confirmed) {
                return;
              }
              removePbxInstance(row.original.id);
              toast.success('PBX 인스턴스를 삭제했습니다.');
            }}
            aria-label="Delete PBX instance"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ),
      }),
    ],
    [removePbxInstance, updatePbxInstance]
  );

  const table = useReactTable({
    data: pbxInstances,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleAddInstance = () => {
    addPbxInstance();
    toast.success('새 PBX 인스턴스를 추가했습니다.');
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
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length > 0 ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-28 text-center text-sm text-muted-foreground">
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
