import { useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Node,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { nodeTypes } from './nodes'
import { edgeTypes } from './edges'
import { useFlowStore } from '@/stores/flowStore'

export function FlowCanvas() {
  const nodes = useFlowStore((s) => s.nodes)
  const edges = useFlowStore((s) => s.edges)
  const { onNodesChange, onEdgesChange, onConnect, addNode, setSelectedNode, setViewport } = useFlowStore((s) => s.actions)
  const { screenToFlowPosition } = useReactFlow()

  const onMoveEnd = useCallback((_event: any, viewport: Viewport) => {
    setViewport(viewport)
  }, [setViewport])

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const nodeType = event.dataTransfer.getData('application/xyflow')
      if (!nodeType) {
        return
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const [type, subtype] = nodeType.split(':')
      const nodeId = `node-${Date.now()}`

      let newNode: Node
      if (type === 'sipInstance') {
        newNode = {
          id: nodeId,
          type: 'sipInstance',
          position,
          data: { label: 'SIP UA' },
        }
      } else if (type === 'command') {
        const commandLabels: Record<string, string> = {
          makeCall: 'Make Call',
          hold: 'Hold',
          retrieve: 'Retrieve',
          blindTransfer: 'Blind Transfer',
          muteTransfer: 'Mute Transfer',
          bye: 'Bye',
          cancel: 'Cancel',
          busy: 'Busy',
        }
        newNode = {
          id: nodeId,
          type: 'command',
          position,
          data: {
            label: commandLabels[subtype] || subtype,
            command: subtype,
          },
        }
      } else if (type === 'event') {
        newNode = {
          id: nodeId,
          type: 'event',
          position,
          data: {
            label: 'Wait Event',
            eventType: 'wait',
          },
        }
      } else {
        return
      }

      addNode(newNode)
    },
    [screenToFlowPosition, addNode]
  )

  const onNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      setSelectedNode(node.id)
    },
    [setSelectedNode]
  )

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [setSelectedNode])

  const isValidConnection = useCallback((connection: { source: string; target: string }) => {
    return connection.source !== connection.target
  }, [])

  return (
    <div className="flex-1 h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onMoveEnd={onMoveEnd}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'flowEdge' }}
        isValidConnection={isValidConnection}
        fitView
        minZoom={0.1}
        maxZoom={3}
        fitViewOptions={{ padding: 0.2 }}
      >
        <Background />
        <Controls />
        <MiniMap zoomable pannable />
        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <p className="text-muted-foreground text-lg">
              Drag nodes from the sidebar to build your SIP flow
            </p>
          </div>
        )}
      </ReactFlow>
    </div>
  )
}
