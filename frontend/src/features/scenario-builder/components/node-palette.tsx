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
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useDnD } from '../hooks/use-dnd';
import { formatEventLabel } from '../lib/event-label';

const PALETTE_ITEM_CLASS =
  'bg-card border-border text-foreground hover:bg-muted/70';

interface PaletteItemProps {
  type: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
}

function PaletteItem({ type, label, icon: Icon, colorClass }: PaletteItemProps) {
  const { setType } = useDnD();

  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/reactflow', type);
    event.dataTransfer.effectAllowed = 'move';
    setType(type);
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`flex items-center gap-2 px-3 py-2 rounded-md cursor-grab active:cursor-grabbing border ${colorClass} transition-colors hover:opacity-80`}
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
  return (
    <div className="space-y-3">
      <Section title="SIP Instance">
        <PaletteItem
          type="sipInstance"
          label="SIP Instance"
          icon={Play}
          colorClass={PALETTE_ITEM_CLASS}
        />
      </Section>

      <Separator />

      <Section title="Commands">
        <PaletteItem
          type="command-MakeCall"
          label="MakeCall"
          icon={Phone}
          colorClass={PALETTE_ITEM_CLASS}
        />
        <PaletteItem
          type="command-Answer"
          label="Answer"
          icon={PhoneIncoming}
          colorClass={PALETTE_ITEM_CLASS}
        />
        <PaletteItem
          type="command-Release"
          label="Release"
          icon={PhoneOff}
          colorClass={PALETTE_ITEM_CLASS}
        />
        <PaletteItem
          type="command-PlayAudio"
          label="PlayAudio"
          icon={Volume2}
          colorClass={PALETTE_ITEM_CLASS}
        />
        <PaletteItem
          type="command-SendDTMF"
          label="SendDTMF"
          icon={Hash}
          colorClass={PALETTE_ITEM_CLASS}
        />
        <PaletteItem
          type="command-Hold"
          label="Hold"
          icon={Pause}
          colorClass={PALETTE_ITEM_CLASS}
        />
        <PaletteItem
          type="command-Retrieve"
          label="Retrieve"
          icon={Play}
          colorClass={PALETTE_ITEM_CLASS}
        />
        <PaletteItem
          type="command-BlindTransfer"
          label="BlindTransfer"
          icon={ArrowRightLeft}
          colorClass={PALETTE_ITEM_CLASS}
        />
        <PaletteItem
          type="command-MuteTransfer"
          label="MuteTransfer"
          icon={ArrowRightLeft}
          colorClass={PALETTE_ITEM_CLASS}
        />
      </Section>

      <Separator />

      <Section title="Events">
        <PaletteItem
          type="event-INCOMING"
          label={formatEventLabel('INCOMING')}
          icon={Bell}
          colorClass={PALETTE_ITEM_CLASS}
        />
        <PaletteItem
          type="event-DISCONNECTED"
          label={formatEventLabel('DISCONNECTED')}
          icon={PhoneMissed}
          colorClass={PALETTE_ITEM_CLASS}
        />
        <PaletteItem
          type="event-RINGING"
          label={formatEventLabel('RINGING')}
          icon={BellRing}
          colorClass={PALETTE_ITEM_CLASS}
        />
        <PaletteItem
          type="event-TIMEOUT"
          label={formatEventLabel('TIMEOUT')}
          icon={Clock}
          colorClass={PALETTE_ITEM_CLASS}
        />
        <PaletteItem
          type="event-HELD"
          label={formatEventLabel('HELD')}
          icon={Pause}
          colorClass={PALETTE_ITEM_CLASS}
        />
        <PaletteItem
          type="event-RETRIEVED"
          label={formatEventLabel('RETRIEVED')}
          icon={Play}
          colorClass={PALETTE_ITEM_CLASS}
        />
        <PaletteItem
          type="event-TRANSFERRED"
          label={formatEventLabel('TRANSFERRED')}
          icon={ArrowRightLeft}
          colorClass={PALETTE_ITEM_CLASS}
        />
        <PaletteItem
          type="event-DTMFReceived"
          label={formatEventLabel('DTMFReceived')}
          icon={Ear}
          colorClass={PALETTE_ITEM_CLASS}
        />
      </Section>
    </div>
  );
}
