import { useState } from 'react';
import {
  Phone,
  PhoneIncoming,
  PhoneOff,
  Smartphone,
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

const SIP_ITEM_CLASS =
  'border-sky-200/80 bg-sky-50 text-sky-950 hover:bg-sky-100 dark:border-sky-900/80 dark:bg-sky-950/30 dark:text-sky-100 dark:hover:bg-sky-950/40';

const COMMAND_ITEM_CLASS =
  'border-violet-200/80 bg-violet-50 text-violet-950 hover:bg-violet-100 dark:border-violet-900/80 dark:bg-violet-950/30 dark:text-violet-100 dark:hover:bg-violet-950/40';

const EVENT_ITEM_CLASS =
  'border-amber-200/80 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-amber-900/80 dark:bg-amber-950/30 dark:text-amber-100 dark:hover:bg-amber-950/40';

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
      className={`flex cursor-grab items-center gap-2 rounded-md border px-3 py-2 transition-colors active:cursor-grabbing ${colorClass}`}
    >
      <Icon className="h-4 w-4" />
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}

interface SectionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  titleClass: string;
}

function Section({ title, children, defaultOpen = true, titleClass }: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`mb-2 flex w-full items-center gap-1 text-sm font-semibold transition-colors ${titleClass}`}
      >
        {isOpen ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
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
      <Section title="SIP Instance" titleClass="text-sky-700 dark:text-sky-300">
        <PaletteItem
          type="sipInstance"
          label="SIP Instance"
          icon={Smartphone}
          colorClass={SIP_ITEM_CLASS}
        />
      </Section>

      <Separator />

      <Section title="Commands" titleClass="text-violet-700 dark:text-violet-300">
        <PaletteItem
          type="command-MakeCall"
          label="MakeCall"
          icon={Phone}
          colorClass={COMMAND_ITEM_CLASS}
        />
        <PaletteItem
          type="command-Answer"
          label="Answer"
          icon={PhoneIncoming}
          colorClass={COMMAND_ITEM_CLASS}
        />
        <PaletteItem
          type="command-Release"
          label="Release"
          icon={PhoneOff}
          colorClass={COMMAND_ITEM_CLASS}
        />
        <PaletteItem
          type="command-PlayAudio"
          label="PlayAudio"
          icon={Volume2}
          colorClass={COMMAND_ITEM_CLASS}
        />
        <PaletteItem
          type="command-SendDTMF"
          label="SendDTMF"
          icon={Hash}
          colorClass={COMMAND_ITEM_CLASS}
        />
        <PaletteItem
          type="command-Hold"
          label="Hold"
          icon={Pause}
          colorClass={COMMAND_ITEM_CLASS}
        />
        <PaletteItem
          type="command-Retrieve"
          label="Retrieve"
          icon={Play}
          colorClass={COMMAND_ITEM_CLASS}
        />
        <PaletteItem
          type="command-BlindTransfer"
          label="BlindTransfer"
          icon={ArrowRightLeft}
          colorClass={COMMAND_ITEM_CLASS}
        />
        <PaletteItem
          type="command-MuteTransfer"
          label="MuteTransfer"
          icon={ArrowRightLeft}
          colorClass={COMMAND_ITEM_CLASS}
        />
      </Section>

      <Separator />

      <Section title="Events" titleClass="text-amber-700 dark:text-amber-300">
        <PaletteItem
          type="event-INCOMING"
          label={formatEventLabel('INCOMING')}
          icon={Bell}
          colorClass={EVENT_ITEM_CLASS}
        />
        <PaletteItem
          type="event-DISCONNECTED"
          label={formatEventLabel('DISCONNECTED')}
          icon={PhoneMissed}
          colorClass={EVENT_ITEM_CLASS}
        />
        <PaletteItem
          type="event-RINGING"
          label={formatEventLabel('RINGING')}
          icon={BellRing}
          colorClass={EVENT_ITEM_CLASS}
        />
        <PaletteItem
          type="event-TIMEOUT"
          label={formatEventLabel('TIMEOUT')}
          icon={Clock}
          colorClass={EVENT_ITEM_CLASS}
        />
        <PaletteItem
          type="event-HELD"
          label={formatEventLabel('HELD')}
          icon={Pause}
          colorClass={EVENT_ITEM_CLASS}
        />
        <PaletteItem
          type="event-RETRIEVED"
          label={formatEventLabel('RETRIEVED')}
          icon={Play}
          colorClass={EVENT_ITEM_CLASS}
        />
        <PaletteItem
          type="event-TRANSFERRED"
          label={formatEventLabel('TRANSFERRED')}
          icon={ArrowRightLeft}
          colorClass={EVENT_ITEM_CLASS}
        />
        <PaletteItem
          type="event-DTMFReceived"
          label={formatEventLabel('DTMFReceived')}
          icon={Ear}
          colorClass={EVENT_ITEM_CLASS}
        />
      </Section>
    </div>
  );
}
