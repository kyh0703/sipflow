import { useState } from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneOff,
  Volume2,
  Hash,
  Ear,
  Bell,
  PhoneMissed,
  BellRing,
  Clock,
  Pause,
  Play,
  ArrowRightLeft,
  MessageSquare,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useDnD } from '../hooks/use-dnd';
import { useExecutionReadOnly } from '../hooks/use-execution';

interface PaletteItemProps {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
  disabled?: boolean;
}

function PaletteItem({ type, label, icon: Icon, colorClass, disabled = false }: PaletteItemProps) {
  const { setType } = useDnD();

  const onDragStart = (event: React.DragEvent) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
    setType(type);
  };

  return (
    <div
      draggable={!disabled}
      onDragStart={onDragStart}
      className={`flex items-center gap-2 px-3 py-2 rounded-md border ${colorClass} transition-colors ${
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'cursor-grab active:cursor-grabbing hover:opacity-80'
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

function Section({ title, children, defaultOpen = true }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 w-full text-sm font-semibold text-foreground mb-2 hover:text-primary transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="w-3 h-3" />
        ) : (
          <ChevronRight className="w-3 h-3" />
        )}
        {title}
      </button>
      {isOpen && <div className="space-y-1.5">{children}</div>}
    </div>
  );
}

export function NodePalette() {
  const isReadOnly = useExecutionReadOnly();

  return (
    <div className="space-y-3">
      {isReadOnly && (
        <div className="rounded-md border border-border bg-muted px-3 py-2 text-xs text-muted-foreground">
          Running 중에는 노드를 추가할 수 없습니다.
        </div>
      )}
      <Section title="SIP Instance">
        <PaletteItem
          type="sipInstance"
          label="SIP Instance"
          icon={Play}
          colorClass="bg-emerald-50 border-emerald-400 text-emerald-900"
          disabled={isReadOnly}
        />
      </Section>

      <Section title="Commands">
        <PaletteItem
          type="command-MakeCall"
          label="MakeCall"
          icon={Phone}
          colorClass="bg-blue-50 border-blue-400 text-blue-900"
          disabled={isReadOnly}
        />
        <PaletteItem
          type="command-Answer"
          label="Answer"
          icon={PhoneIncoming}
          colorClass="bg-blue-50 border-blue-400 text-blue-900"
          disabled={isReadOnly}
        />
        <PaletteItem
          type="command-Release"
          label="Release"
          icon={PhoneOff}
          colorClass="bg-blue-50 border-blue-400 text-blue-900"
          disabled={isReadOnly}
        />
        <PaletteItem
          type="command-PlayAudio"
          label="PlayAudio"
          icon={Volume2}
          colorClass="bg-blue-50 border-blue-400 text-blue-900"
          disabled={isReadOnly}
        />
        <PaletteItem
          type="command-SendDTMF"
          label="SendDTMF"
          icon={Hash}
          colorClass="bg-blue-50 border-blue-400 text-blue-900"
          disabled={isReadOnly}
        />
        <PaletteItem
          type="command-Hold"
          label="Hold"
          icon={Pause}
          colorClass="bg-blue-50 border-blue-400 text-blue-900"
          disabled={isReadOnly}
        />
        <PaletteItem
          type="command-Retrieve"
          label="Retrieve"
          icon={Play}
          colorClass="bg-blue-50 border-blue-400 text-blue-900"
          disabled={isReadOnly}
        />
        <PaletteItem
          type="command-BlindTransfer"
          label="BlindTransfer"
          icon={ArrowRightLeft}
          colorClass="bg-blue-50 border-blue-400 text-blue-900"
          disabled={isReadOnly}
        />
        <PaletteItem
          type="command-MuteTransfer"
          label="MuteTransfer"
          icon={ArrowRightLeft}
          colorClass="bg-blue-50 border-blue-400 text-blue-900"
          disabled={isReadOnly}
        />
      </Section>

      <Section title="Events">
        <PaletteItem
          type="event-INCOMING"
          label="INCOMING"
          icon={Bell}
          colorClass="bg-amber-50 border-amber-400 text-amber-900"
          disabled={isReadOnly}
        />
        <PaletteItem
          type="event-DISCONNECTED"
          label="DISCONNECTED"
          icon={PhoneMissed}
          colorClass="bg-amber-50 border-amber-400 text-amber-900"
          disabled={isReadOnly}
        />
        <PaletteItem
          type="event-RINGING"
          label="RINGING"
          icon={BellRing}
          colorClass="bg-amber-50 border-amber-400 text-amber-900"
          disabled={isReadOnly}
        />
        <PaletteItem
          type="event-TIMEOUT"
          label="TIMEOUT"
          icon={Clock}
          colorClass="bg-amber-50 border-amber-400 text-amber-900"
          disabled={isReadOnly}
        />
        <PaletteItem
          type="event-HELD"
          label="HELD"
          icon={Pause}
          colorClass="bg-amber-50 border-amber-400 text-amber-900"
          disabled={isReadOnly}
        />
        <PaletteItem
          type="event-RETRIEVED"
          label="RETRIEVED"
          icon={Play}
          colorClass="bg-amber-50 border-amber-400 text-amber-900"
          disabled={isReadOnly}
        />
        <PaletteItem
          type="event-TRANSFERRED"
          label="TRANSFERRED"
          icon={ArrowRightLeft}
          colorClass="bg-amber-50 border-amber-400 text-amber-900"
          disabled={isReadOnly}
        />
        <PaletteItem
          type="event-NOTIFY"
          label="NOTIFY"
          icon={MessageSquare}
          colorClass="bg-amber-50 border-amber-400 text-amber-900"
          disabled={isReadOnly}
        />
        <PaletteItem
          type="event-DTMFReceived"
          label="DTMFReceived"
          icon={Ear}
          colorClass="bg-amber-50 border-amber-400 text-amber-900"
          disabled={isReadOnly}
        />
      </Section>
    </div>
  );
}
