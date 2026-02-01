import { Spinner } from '@/components/ui/spinner'
import { Suspense } from 'react'
import FlowHeader from '../_components/flow-header'
import FlowList from '../_components/flow-list'

type ProjectPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<{ name: string }>
}

export default async function ProjectPage({
  params,
  searchParams,
}: Readonly<ProjectPageProps>) {
  const { id } = await params
  const { name } = await searchParams

  if (!id || !name) {
    return <div>Project ID or name not found</div>
  }

  return (
    <div className="flex h-full w-full flex-col">
      <FlowHeader projectId={id} projectName={name} />
      <main className="flex-1">
        <Suspense fallback={<Spinner size="xl" />}>
          <FlowList projectId={id} />
        </Suspense>
      </main>
    </div>
  )
}
