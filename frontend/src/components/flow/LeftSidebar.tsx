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
  Plus,
  Trash2,
  type LucideIcon,
} from 'lucide-react'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { useFlowStore } from '@/stores/flowStore'
import { useProjectStore } from '@/stores/projectStore'
import { useFlowPersistence } from '@/hooks/useFlowPersistence'
import { flowService, isSuccess } from '@/services/flowService'

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
  const projectPath = useProjectStore((s) => s.projectPath)
  const flows = useProjectStore((s) => s.flows)
  const currentFlowId = useProjectStore((s) => s.currentFlowId)
  const projectActions = useProjectStore((s) => s.actions)
  const flowActions = useFlowStore((s) => s.actions)
  const { switchFlow } = useFlowPersistence()

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

  const handleNewFlow = async () => {
    if (!projectPath) return

    try {
      const response = await flowService.createFlow('New Flow')
      if (isSuccess(response) && response.data?.id) {
        await projectActions.refreshFlowList()
        await switchFlow(response.data.id)
      } else {
        console.error('Failed to create flow:', response.error)
      }
    } catch (error) {
      console.error('Failed to create flow:', error)
    }
  }

  const handleDeleteFlow = async (flowId: number, flowName: string) => {
    const confirmed = window.confirm(
      `Delete flow "${flowName}"? This cannot be undone.`
    )
    if (!confirmed) return

    try {
      const response = await flowService.deleteFlow(flowId)
      if (isSuccess(response)) {
        // If deleted flow was the current flow, clear canvas
        if (currentFlowId === flowId) {
          flowActions.setNodes([])
          flowActions.setEdges([])
          projectActions.setCurrentFlowId(null)
          projectActions.markClean()
        }
        await projectActions.refreshFlowList()
      } else {
        console.error('Failed to delete flow:', response.error)
      }
    } catch (error) {
      console.error('Failed to delete flow:', error)
    }
  }

  return (
    <div className="w-60 border-r bg-background h-full overflow-y-auto">
      <div className="p-4">
        {/* Flow List Section */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-lg">Flows</h2>
            {projectPath && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleNewFlow}
                title="New Flow"
              >
                <Plus className="w-4 h-4" />
              </Button>
            )}
          </div>

          {!projectPath ? (
            <p className="text-sm text-muted-foreground">
              No project open. Use File &gt; New or File &gt; Open.
            </p>
          ) : flows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No flows yet. Click + to create one.
            </p>
          ) : (
            <div className="space-y-1">
              {flows.map((flow) => (
                <div
                  key={flow.id}
                  className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-sm cursor-pointer transition-colors ${
                    currentFlowId === flow.id
                      ? 'bg-accent text-accent-foreground'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => switchFlow(flow.id)}
                >
                  <span className="truncate flex-1">{flow.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDeleteFlow(flow.id, flow.name)
                    }}
                    title="Delete flow"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="border-t my-3" />

        {/* Node Palette Section */}
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
