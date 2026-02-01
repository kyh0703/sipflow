import { SidebarProvider } from '@/components/ui/sidebar'
import type { PropsWithChildren } from 'react'
import LeftSidebar from './_components/left-sidebar'

export default function ProjectsLayout({
  children,
}: Readonly<PropsWithChildren>) {
  return (
    <SidebarProvider>
      <div className="flex h-full w-full">
        <LeftSidebar />
        <div className="flex flex-1 flex-col">{children}</div>
      </div>
    </SidebarProvider>
  )
}
