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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { Badge } from '@/components/ui/badge'
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
    <div className="w-60 border-r bg-background h-full flex flex-col">
      {/* Flow List Section */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold tracking-tight">Flows</h2>
          <div className="flex items-center gap-1">
            {projectPath && (
              <>
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {flows.length}
                </Badge>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={handleNewFlow}
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="right">New Flow</TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>

        {!projectPath ? (
          <p className="text-xs text-muted-foreground px-1">
            No project open. Use File &gt; New or File &gt; Open.
          </p>
        ) : flows.length === 0 ? (
          <p className="text-xs text-muted-foreground px-1">
            No flows yet. Click + to create one.
          </p>
        ) : (
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-0.5">
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
                  <span className="truncate flex-1 text-xs">{flow.name}</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDeleteFlow(flow.id, flow.name)
                        }}
                      >
                        <Trash2 className="w-3 h-3 text-destructive" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="right">Delete flow</TooltipContent>
                  </Tooltip>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <Separator />

      {/* Node Palette Section */}
      <ScrollArea className="flex-1">
        <div className="p-3">
          <h2 className="text-sm font-semibold tracking-tight mb-2">Node Palette</h2>
          <Accordion
            type="multiple"
            defaultValue={['SIP Instance', 'Commands', 'Events']}
            className="space-y-1"
          >
            {nodeCategories.map((category) => (
              <AccordionItem key={category.title} value={category.title} className="border-b-0">
                <AccordionTrigger className="text-xs font-medium py-1.5 hover:no-underline">
                  <div className="flex items-center gap-2">
                    {category.title}
                    <Badge variant="outline" className="text-[10px] px-1 py-0 font-normal">
                      {category.items.length}
                    </Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-1">
                  <div className="grid grid-cols-2 gap-1.5 pt-1">
                    {category.items.map((item) => {
                      const Icon = item.icon
                      return (
                        <Tooltip key={item.command}>
                          <TooltipTrigger asChild>
                            <div
                              draggable
                              onDragStart={(event) => onDragStart(event, item)}
                              className="flex flex-col items-center gap-1 p-2 border border-dashed rounded-md cursor-grab hover:bg-accent hover:border-accent-foreground/20 active:cursor-grabbing transition-colors"
                            >
                              <Icon className="w-4 h-4" />
                              <span className="text-[10px] text-center leading-tight">{item.label}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            Drag to canvas
                          </TooltipContent>
                        </Tooltip>
                      )
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </ScrollArea>
    </div>
  )
}
