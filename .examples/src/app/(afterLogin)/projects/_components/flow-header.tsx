'use client'

import { Modal } from '@/components/modal'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import type { Flow } from '@/models/flow'
import { useAddFlow } from '@/services/projects'
import { Crown, Filter, LayoutGrid, List, Plus, Search } from 'lucide-react'
import Link from 'next/link'
import { overlay } from 'overlay-kit'
import FlowModal from './flow-modal'

type FlowHeaderProps = {
  projectId: string
  projectName: string
}

export default function FlowHeader({
  projectId,
  projectName,
}: Readonly<FlowHeaderProps>) {
  const addFlowMutation = useAddFlow()

  const handleNewFlowClick = async () => {
    const result = await overlay.openAsync(({ isOpen, close, unmount }) => (
      <Modal isOpen={isOpen} title="New Flow" onExit={unmount}>
        <FlowModal onClose={close} />
      </Modal>
    ))

    if (!result) return

    const newFlow = result as Flow & { id: string }
    addFlowMutation.mutate({ projectId, flow: newFlow })
  }

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-border/40 border-b backdrop-blur">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link href="/projects">Projects</Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{projectName}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Separator orientation="vertical" className="h-6" />

          <div className="relative max-w-md">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              placeholder="Search flows..."
              className="bg-muted/50 focus-visible:ring-ring h-9 w-80 border-0 pl-9 focus-visible:ring-1"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-muted/50 flex items-center gap-1 rounded-lg p-1">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              <List className="h-4 w-4" />
            </Button>
          </div>

          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Filter className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="flex items-center gap-1 text-xs"
            >
              <Crown className="size-3" />
            </Badge>
          </div>

          <Button
            size="sm"
            className="flex h-8 items-center gap-1"
            onClick={handleNewFlowClick}
          >
            <Plus className="size-4" />
            New Flow
          </Button>
        </div>
      </div>
    </header>
  )
}
