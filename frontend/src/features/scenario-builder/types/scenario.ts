import type { Node } from '@xyflow/react';

// Node categories constant
export const NODE_CATEGORIES = {
  SIP_INSTANCE: 'sipInstance',
  COMMAND: 'command',
  EVENT: 'event',
} as const;

// Command types (MVP Phase 2 + v1.2 Hold/Retrieve/BlindTransfer)
export const COMMAND_TYPES = ['MakeCall', 'Answer', 'Release', 'PlayAudio', 'SendDTMF', 'Hold', 'Retrieve', 'BlindTransfer'] as const;

// Event types (full set)
export const EVENT_TYPES = [
  'INCOMING',
  'DISCONNECTED',
  'RINGING',
  'TIMEOUT',
  'HELD',
  'RETRIEVED',
  'TRANSFERRED',
  'NOTIFY',
  'DTMFReceived',
] as const;

// Instance color presets
export const INSTANCE_COLORS = [
  '#3b82f6', // blue
  '#14b8a6', // teal
  '#f97316', // orange
  '#a855f7', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
] as const;

// Available codecs for SIP instances
export const AVAILABLE_CODECS = ['PCMU', 'PCMA'] as const;

// Default codec selection (all codecs enabled, PCMU first)
export const DEFAULT_CODECS: string[] = ['PCMU', 'PCMA'];

// SIP Instance Node
export interface SipInstanceNodeData extends Record<string, unknown> {
  label: string;
  mode: 'DN' | 'Endpoint';
  dn?: string;
  register: boolean;
  serverId?: string;
  color: string;
  codecs?: string[]; // ["PCMU", "PCMA"] — codec priority order
}

export type SipInstanceNode = Node<SipInstanceNodeData, 'sipInstance'>;

// Command Node
export interface CommandNodeData extends Record<string, unknown> {
  label: string;
  command: (typeof COMMAND_TYPES)[number];
  sipInstanceId?: string;
  targetUri?: string; // for MakeCall
  timeout?: number; // milliseconds
  filePath?: string; // for PlayAudio WAV file absolute path
  digits?: string; // for SendDTMF: DTMF digit string (e.g. "1234*#")
  intervalMs?: number; // for SendDTMF: interval between digits in milliseconds (default 100)
  targetUser?: string; // for BlindTransfer: target SIP user
  targetHost?: string; // for BlindTransfer: target SIP host:port
}

export type CommandNode = Node<CommandNodeData, 'command'>;

// Event Node
export interface EventNodeData extends Record<string, unknown> {
  label: string;
  event: (typeof EVENT_TYPES)[number];
  sipInstanceId?: string;
  timeout?: number; // for TIMEOUT event
  expectedDigit?: string; // for DTMFReceived: specific digit to wait for (empty = any digit)
}

export type EventNode = Node<EventNodeData, 'event'>;

// Union type for all scenario nodes
export type ScenarioNode = SipInstanceNode | CommandNode | EventNode;

// Branch edge data
export interface BranchEdgeData {
  branchType: 'success' | 'failure';
}
