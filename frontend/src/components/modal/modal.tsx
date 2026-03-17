import { DialogDescription } from '@radix-ui/react-dialog'
import { Suspense, type PropsWithChildren } from 'react'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

type ModalProps = {
  isOpen?: boolean
  title?: string
  description?: string
  className?: string
  onExit?: () => void
} & PropsWithChildren

function Modal({
  children,
  title,
  description,
  className,
  isOpen = false,
  onExit,
}: ModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onExit}>
      <DialogContent
        className={cn(
          'flex min-w-[22rem] max-w-xl flex-col items-center justify-center gap-5 rounded-sm border border-border bg-card p-6 text-card-foreground shadow-lg',
          className,
        )}
      >
        {(title || description) && (
          <DialogHeader className="mx-auto flex w-full flex-col items-start justify-between space-y-0">
            {title ? <DialogTitle className="text-xl font-semibold">{title}</DialogTitle> : null}
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
        )}
        <div className="w-full">
          <Suspense fallback={<Spinner className="text-primary size-8" />}>
            {children}
          </Suspense>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function ModalContent({ children }: PropsWithChildren) {
  return (
    <div className="z-10 max-h-[30rem] w-full space-y-6 overflow-y-auto whitespace-pre-line rounded-sm bg-card p-5 text-card-foreground">
      {children}
    </div>
  )
}

function ModalAction({ children }: PropsWithChildren) {
  return <div className="mt-5 flex w-full justify-end gap-4">{children}</div>
}

export { Modal, ModalAction, ModalContent }
