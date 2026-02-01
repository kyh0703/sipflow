import { Spinner } from '@/components/ui/spinner'
import { Suspense } from 'react'
import ProjectHeader from './_components/project-header'
import ProjectList from './_components/project-list'

export default function ProjectsPage() {
  return (
    <div className="flex h-full w-full flex-col">
      <ProjectHeader />
      <div className="flex-1">
        <Suspense fallback={<Spinner />}>
          <ProjectList />
        </Suspense>
      </div>
    </div>
  )
}
