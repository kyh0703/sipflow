import {
  PhoneCall,
  PhoneOff,
  X,
  Pause,
  Play,
  PhoneForwarded,
  BellOff,
  type LucideIcon,
} from 'lucide-react'
import type { CommandType } from '@/types/nodes'

/**
 * Icon mapping for each command type
 * Uses lucide-react icons to visually distinguish command types
 */
export const commandIcons: Record<CommandType, LucideIcon> = {
  makeCall: PhoneCall,
  bye: PhoneOff,
  cancel: X,
  hold: Pause,
  retrieve: Play,
  blindTransfer: PhoneForwarded,
  muteTransfer: PhoneForwarded, // Same icon as blind transfer
  busy: BellOff,
}

export type { CommandType }
