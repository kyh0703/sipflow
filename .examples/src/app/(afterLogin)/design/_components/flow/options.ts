import {
  MarkerType,
  type FitViewOptions,
  type ProOptions,
  type Viewport,
} from '@xyflow/react'

const proOptions: ProOptions = {
  account: process.env.PRO_OPTION,
  hideAttribution: true,
}

const fitViewOptions: FitViewOptions = {
  minZoom: 0.1,
  maxZoom: 2.0,
}

const viewPort: Viewport = {
  x: 100,
  y: 100,
  zoom: 2.0,
}

const defaultEdgeOptions = {
  style: { strokeWidth: 3, stroke: 'black' },
  type: 'floating',
  markerEnd: {
    type: MarkerType.ArrowClosed,
    color: 'black',
  },
}

const connectionLineStyle = {
  strokeWidth: 3,
  stroke: 'black',
}

export {
  connectionLineStyle,
  defaultEdgeOptions,
  fitViewOptions,
  proOptions,
  viewPort,
}
