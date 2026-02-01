'use client'

import { Modal } from '@/components/modal'
import { Badge } from '@/components/ui/badge'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import type { Project } from '@/models/project'
import { useAddProject } from '@/services/projects'
import { useProjectActions, useProjectSearch } from '@/stores/project-store'
import { Crown, Plus, Search } from 'lucide-react'
import { overlay } from 'overlay-kit'
import ProjectModal from './project-modal'

export default function ProjectHeader() {
  const search = useProjectSearch()
  const { setSearch } = useProjectActions()

  const addProjectMutation = useAddProject()

  const handleNewProject = async () => {
    const result = await overlay.openAsync(({ isOpen, close, unmount }) => (
      <Modal isOpen={isOpen} title="New Project" onExit={unmount}>
        <ProjectModal onClose={close} />
      </Modal>
    ))
    if (!result) return
    const newProject = result as Project
    addProjectMutation.mutate(newProject)
  }

  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-border/40 border-b backdrop-blur">
      <div className="flex h-16 items-center justify-between px-6">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbPage>All Projects</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <Separator orientation="vertical" className="h-6" />

          <div className="relative max-w-md">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform" />
            <Input
              placeholder="Search projects..."
              className="bg-muted/50 focus-visible:ring-ring h-9 w-80 border-0 pl-9 focus-visible:ring-1"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Separator orientation="vertical" className="h-6" />

          <div className="flex items-center gap-2">
            <Badge
              variant="secondary"
              className="flex items-center gap-1 text-xs"
            >
              <Crown className="size-3" />
            </Badge>

            <span className="text-muted-foreground text-sm">Pro</span>
          </div>

          <Button
            size="sm"
            className="flex h-8 items-center gap-1"
            onClick={handleNewProject}
          >
            <Plus className="size-4" />
            New Project
          </Button>
        </div>
      </div>
    </header>
  )
}
