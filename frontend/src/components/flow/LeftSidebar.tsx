import {
  Phone,
  PhoneCall,
  Pause,
  Play,
  PhoneForwarded,
  Volume2,
  PhoneOff,
  XCircle,
  PhoneMissed,
  Radio,
  type LucideIcon,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useFlowStore } from '@/stores/flowStore'

interface NodeItem {
  type: string
  label: string
  command: string
  icon: LucideIcon
}

const commandIcons: Record<string, LucideIcon> = {
  makeCall: PhoneCall,
  hold: Pause,
  retrieve: Play,
  blindTransfer: PhoneForwarded,
  muteTransfer: Volume2,
  bye: PhoneOff,
  cancel: XCircle,
  busy: PhoneMissed,
}

const nodeCategories: { title: string; items: NodeItem[] }[] = [
  {
    title: 'SIP Instance',
    items: [
      {
        type: 'sipInstance',
        label: 'SIP UA',
        command: 'sipInstance',
        icon: Phone,
      },
    ],
  },
  {
    title: 'Commands',
    items: [
      { type: 'command', label: 'Make Call', command: 'makeCall', icon: PhoneCall },
      { type: 'command', label: 'Hold', command: 'hold', icon: Pause },
      { type: 'command', label: 'Retrieve', command: 'retrieve', icon: Play },
      { type: 'command', label: 'Blind Transfer', command: 'blindTransfer', icon: PhoneForwarded },
      { type: 'command', label: 'Mute Transfer', command: 'muteTransfer', icon: Volume2 },
      { type: 'command', label: 'Bye', command: 'bye', icon: PhoneOff },
      { type: 'command', label: 'Cancel', command: 'cancel', icon: XCircle },
      { type: 'command', label: 'Busy', command: 'busy', icon: PhoneMissed },
    ],
  },
  {
    title: 'Events',
    items: [
      {
        type: 'event',
        label: 'Wait Event',
        command: 'wait',
        icon: Radio,
      },
    ],
  },
]

export function LeftSidebar() {
  const sidebarOpen = useFlowStore((s) => s.sidebarOpen)

  if (!sidebarOpen) {
    return null
  }

  const onDragStart = (event: React.DragEvent, item: NodeItem) => {
    if (item.type === 'command') {
      event.dataTransfer.setData('application/xyflow', `command:${item.command}`)
    } else if (item.type === 'sipInstance') {
      event.dataTransfer.setData('application/xyflow', 'sipInstance')
    } else if (item.type === 'event') {
      event.dataTransfer.setData('application/xyflow', `event:${item.command}`)
    }
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="w-60 border-r bg-background h-full overflow-y-auto">
      <div className="p-4">
        <h2 className="font-semibold text-lg mb-4">Node Palette</h2>
        <Accordion
          type="multiple"
          defaultValue={['SIP Instance', 'Commands', 'Events']}
          className="space-y-2"
        >
          {nodeCategories.map((category) => (
            <AccordionItem key={category.title} value={category.title}>
              <AccordionTrigger className="text-sm font-medium">
                {category.title}
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  {category.items.map((item) => {
                    const Icon = item.icon
                    return (
                      <div
                        key={item.command}
                        draggable
                        onDragStart={(event) => onDragStart(event, item)}
                        className="flex flex-col items-center gap-1 p-3 border border-dashed rounded-lg cursor-grab hover:bg-muted active:cursor-grabbing transition-colors"
                      >
                        <Icon className="w-5 h-5" />
                        <span className="text-xs text-center">{item.label}</span>
                      </div>
                    )
                  })}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  )
}
