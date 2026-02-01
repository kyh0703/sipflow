import type { EdgeTypes } from '@xyflow/react'
import { EasyConnectingEdge } from './easy-connecting-edge'

export enum Algorithm {
  Linear = 'linear',
  CatmullRom = 'catmull-rom',
  BezierCatmullRom = 'bezier-catmull-rom',
}

export const edgeTypes: EdgeTypes = {
  start: EasyConnectingEdge,
}
