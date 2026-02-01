import {
  Circle,
  Database,
  Diamond,
  FileText,
  Square,
  Triangle,
  Zap,
} from 'lucide-react'

export type Component = {
  type: string
  icon: React.ElementType
  color: string
}

export const components: Component[] = [
  { type: 'input', icon: Circle, color: 'bg-blue-500' },
  { type: 'default', icon: Square, color: 'bg-green-500' },
  { type: 'output', icon: Triangle, color: 'bg-red-500' },
  { type: 'condition', icon: Diamond, color: 'bg-yellow-500' },
  { type: 'api', icon: Zap, color: 'bg-purple-500' },
  { type: 'database', icon: Database, color: 'bg-indigo-500' },
  { type: 'document', icon: FileText, color: 'bg-orange-500' },
]
