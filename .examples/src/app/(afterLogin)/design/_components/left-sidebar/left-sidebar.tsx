'use client'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CustomNodeType } from '@xyflow/react'
import { Circle, Search } from 'lucide-react'
import { useState } from 'react'
import { DragItem } from './drag-item'

const nodeTypes = [
  { type: 'default', name: 'default', icon: Circle },
  { type: 'start', name: 'start', icon: Circle },
]

export function LeftSidebar() {
  const [searchTerm, setSearchTerm] = useState('')

  return (
    <Accordion type="single" collapsible>
      <div className="bg-background/95 border-border/40 supports-[backdrop-filter]:bg-background/60 flex h-full w-full flex-col border-r backdrop-blur">
        <div className="border-border/40 border-b p-4">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              placeholder="Search components..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-muted/50 focus-visible:ring-ring h-8 border-0 pl-9 focus-visible:ring-1"
            />
          </div>
        </div>

        <Tabs defaultValue="components" className="flex h-full w-full">
          <TabsList className="grid w-full grid-cols-3 rounded-none">
            <TabsTrigger value="components" className="min-w-10 text-xs">
              Components
            </TabsTrigger>
          </TabsList>

          <TabsContent
            value="components"
            className="m-0 w-full space-y-0 p-4 pt-4"
          >
            <div className="space-y-2">
              <AccordionItem value="node-types">
                <AccordionTrigger className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                  Node Types
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    {nodeTypes.map((nodeType) => (
                      <DragItem
                        key={nodeType.type}
                        type={nodeType.type as CustomNodeType}
                        icon={nodeType.icon}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Accordion>
  )
}
