'use client'

import { ConfirmModal, showConfirmModal } from '@/components/confirm-modal'
import { Modal } from '@/components/modal'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { cn } from '@/lib'
import type { Flow } from '@/models/flow'
import { useRemoveFlow, useUpdateFlow } from '@/services/projects'
import { formatRelativeTime } from '@/utils'
import { Calendar, Edit, Star, Trash2, Workflow } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { overlay } from 'overlay-kit'
import FlowModal from './flow-modal'

type FlowCardProps = {
  flow: Flow
}

export default function FlowCard({ flow }: Readonly<FlowCardProps>) {
  const router = useRouter()
  const updateFlowMutation = useUpdateFlow()
  const removeFlowMutation = useRemoveFlow()

  const handleStarToggle = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    updateFlowMutation.mutate({
      projectId: flow.projectId,
      flowId: flow.id,
      data: { starred: !flow.starred },
    })
  }

  const handleEditClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const result = await overlay.openAsync<Flow | null>(
      ({ isOpen, close, unmount }) => {
        return (
          <Modal isOpen={isOpen} title="Edit Flow" onExit={unmount}>
            <FlowModal initialData={flow} onClose={close} />
          </Modal>
        )
      },
    )
    if (!result) return
    updateFlowMutation.mutate({
      projectId: flow.projectId,
      flowId: flow.id,
      data: {
        name: result.name,
        description: result.description,
      },
    })
  }

  const handleDeleteClick = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const result = await showConfirmModal(
      `'${flow.name}' 플로우를 정말 삭제하시겠습니까?`,
    )
    if (!result) return

    removeFlowMutation.mutate({
      projectId: flow.projectId,
      flowId: flow.id,
    })
  }

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    router.push(`/design/${flow.projectId}/${flow.id}`)
  }

  return (
    <Card
      className="group border-border/50 bg-card/50 hover:border-border relative flex h-full flex-col overflow-hidden border backdrop-blur-sm transition-all duration-200 hover:shadow-lg hover:shadow-black/5"
      onDoubleClick={handleDoubleClick}
    >
      <div className="from-primary/5 absolute inset-0 bg-gradient-to-br to-transparent opacity-0 transition-opacity duration-200 group-hover:opacity-100" />

      <CardHeader className="relative space-y-0 p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-blue-200/20 bg-gradient-to-br from-blue-500/10 to-blue-600/5">
              <Workflow className="h-5 w-5 text-blue-600" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-base leading-none font-semibold">
                {flow.name}
              </CardTitle>
              <div className="text-muted-foreground mt-1 text-xs">
                <Calendar className="mr-1 h-3 w-3" />
                {flow.updatedAt
                  ? formatRelativeTime(flow.updatedAt)
                  : '시간 정보 없음'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 w-8 cursor-pointer p-0 transition-all duration-200',
                'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-blue-500',
              )}
              onClick={handleEditClick}
              disabled={updateFlowMutation.isPending}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 w-8 cursor-pointer p-0 transition-all duration-200',
                'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-red-500',
              )}
              onClick={handleDeleteClick}
              disabled={removeFlowMutation.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                'h-8 w-8 cursor-pointer p-0 transition-all duration-200',
                flow.starred
                  ? 'text-yellow-500 hover:text-yellow-600'
                  : 'text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-yellow-500',
              )}
              onClick={handleStarToggle}
              disabled={updateFlowMutation.isPending}
            >
              <Star
                className={`h-4 w-4 transition-all duration-200 ${
                  flow.starred ? 'fill-current' : ''
                }`}
              />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 p-4 pt-0">
        <CardDescription className="line-clamp-2 text-sm leading-relaxed">
          {flow.description || '플로우 설명이 없습니다'}
        </CardDescription>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-muted-foreground text-xs">활성</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
