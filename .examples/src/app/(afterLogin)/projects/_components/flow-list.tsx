'use client'

import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useInView } from 'react-intersection-observer'
import { useInfiniteQueryFlows } from '@/services/projects'
import FlowCard from './flow-card'
import { Spinner } from '@/components/ui/spinner'

type FlowListProps = {
  projectId: string
}

export default function FlowList({ projectId }: Readonly<FlowListProps>) {
  const { ref, inView } = useInView({
    threshold: 0,
    delay: 0,
  })
  const {
    data,
    error,
    fetchNextPage,
    hasNextPage,
    isFetching,
    isFetchingNextPage,
    status,
  } = useInfiniteQuery(useInfiniteQueryFlows(projectId))

  const flows = data?.pages.flatMap((page) => page.data) || []

  useEffect(() => {
    if (inView && !isFetching && hasNextPage) {
      fetchNextPage()
    }
  }, [inView])

  if (status === 'pending') {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner size="lg" />
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="text-destructive flex h-40 items-center justify-center">
        플로우 불러오기 실패: {error.message}
      </div>
    )
  }

  return (
    <div
      className="h-[calc(100vh-6rem)] w-full overflow-auto"
      id="scrollableDiv"
    >
      {flows.length === 0 ? (
        <div className="flex h-[60vh] flex-col items-center justify-center space-y-4">
          <div className="text-muted-foreground text-center">
            <div className="mb-4 text-6xl">📋</div>
            <h3 className="text-foreground text-lg font-semibold">
              플로우가 없습니다
            </h3>
            <p className="text-sm">새로운 플로우를 생성해서 시작해보세요</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 p-6 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {flows.map((flow) => (
            <FlowCard key={flow.id} flow={flow} />
          ))}
        </div>
      )}
      {isFetchingNextPage ? (
        <div className="fixed right-4 bottom-4">
          <Spinner size="lg" />
        </div>
      ) : (
        <div ref={ref} style={{ height: 50 }} />
      )}
    </div>
  )
}
