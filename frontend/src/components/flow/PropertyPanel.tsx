import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { useFlowStore } from '@/stores/flowStore'
import { SIPInstancePanel } from './panels/SIPInstancePanel'
import { CommandPanel } from './panels/CommandPanel'
import { EventPanel } from './panels/EventPanel'
import type {
  SIPInstanceNodeData,
  CommandNodeData,
  EventNodeData,
} from '@/types/nodes'

export function PropertyPanel() {
  const selectedNodeId = useFlowStore((s) => s.selectedNodeId)
  const nodes = useFlowStore((s) => s.nodes)
  const updateNodeData = useFlowStore((s) => s.actions.updateNodeData)
  const setSelectedNode = useFlowStore((s) => s.actions.setSelectedNode)

  const selectedNode = nodes.find((n) => n.id === selectedNodeId)

  const [localData, setLocalData] = useState<Record<string, unknown>>({})

  // Reset localData when selection changes
  useEffect(() => {
    if (selectedNode) {
      setLocalData({ ...selectedNode.data })
    }
  }, [selectedNode])

  const handleSave = () => {
    if (selectedNodeId) {
      updateNodeData(selectedNodeId, localData)
      setSelectedNode(null)
    }
  }

  const handleCancel = () => {
    setSelectedNode(null)
  }

  const getTitle = (): string => {
    if (!selectedNode) {
      return 'Properties'
    }
    switch (selectedNode.type) {
      case 'sipInstance':
        return 'SIP Instance Properties'
      case 'command':
        return 'Command Properties'
      case 'event':
        return 'Event Properties'
      default:
        return 'Properties'
    }
  }

  return (
    <Sheet
      open={!!selectedNodeId}
      onOpenChange={(open) => {
        if (!open) {
          handleCancel()
        }
      }}
    >
      <SheetContent side="right" className="w-[400px] sm:w-[450px]">
        <SheetHeader>
          <SheetTitle>{getTitle()}</SheetTitle>
        </SheetHeader>

        <div className="py-6">
          {selectedNode?.type === 'sipInstance' && (
            <SIPInstancePanel
              data={localData as SIPInstanceNodeData}
              onChange={(data) => setLocalData(data)}
            />
          )}

          {selectedNode?.type === 'command' && (
            <CommandPanel
              data={localData as CommandNodeData}
              onChange={(data) => setLocalData(data)}
            />
          )}

          {selectedNode?.type === 'event' && (
            <EventPanel
              data={localData as EventNodeData}
              onChange={(data) => setLocalData(data)}
            />
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
