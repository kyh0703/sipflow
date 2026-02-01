import ProjectList from './project-list'

export default function ProjectDashboard() {
  return (
    <div className="flex h-full w-full flex-col">
      <main className="flex-1 p-4">
        <ProjectList />
      </main>
    </div>
  )
}
