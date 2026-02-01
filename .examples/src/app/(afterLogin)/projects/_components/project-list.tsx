'use client'

import { useProjectSearch } from '@/stores/project-store'
import { Spinner } from '@/components/ui/spinner'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useMemo } from 'react'
import { useInView } from 'react-intersection-observer'
import { useInfiniteQueryProjects } from '@/services/projects'
import ProjectCard from './project-card'

export default function ProjectList() {
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
  } = useInfiniteQuery(useInfiniteQueryProjects())

  const search = useProjectSearch()
  const allProjects = data?.pages.flatMap((page) => page.data) || []

  const projects = useMemo(() => {
    if (!search.trim()) return allProjects
    return allProjects.filter((project) =>
      project.name.toLowerCase().includes(search.toLowerCase()),
    )
  }, [allProjects, search])

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
        게시물 불러오기 실패: {error.message}
      </div>
    )
  }

  return (
    <div
      className="h-[calc(100vh-6rem)] w-full overflow-auto"
      id="scrollableDiv"
    >
      {projects.length === 0 ? (
        <div className="text-muted-foreground flex h-40 items-center justify-center">
          프로젝트가 없습니다
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-4 p-4">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
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
