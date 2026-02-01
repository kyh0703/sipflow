import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { XIcon } from 'lucide-react'
import { Suspense, useRef, type PropsWithChildren } from 'react'

type ModalProps = {
  isOpen?: boolean
  title?: string
  className?: string
  onExit?: () => void
} & PropsWithChildren

const Modal = ({
  children,
  title,
  className,
  isOpen = false,
  onExit,
}: ModalProps) => {
  const prevIsOpenRef = useRef(isOpen)
  if (isOpen !== prevIsOpenRef.current) {
    prevIsOpenRef.current = isOpen

    if (!prevIsOpenRef.current) {
      setTimeout(() => onExit?.(), 300)
    }
  }

  return (
    isOpen && (
      <section className="bg-dialog-overlay animate-in fade-in-10 fixed top-0 left-0 z-30 flex h-full w-full items-center justify-center">
        <div
          className={cn(
            'w-2/6',
            'flex flex-col items-center justify-center gap-5',
            'text-dialog-foreground bg-card p-6',
            'border-border rounded-sm border shadow-lg',
            className,
          )}
        >
          <div className="flex w-full items-center justify-between">
            <h1 className={cn('font-poppins text-xl font-semibold')}>
              {title}
            </h1>
            <Button variant="ghost" size="icon" onClick={onExit}>
              <XIcon size={20} />
            </Button>
          </div>
          <div className="w-full">
            <Suspense fallback={<Spinner />}>{children}</Suspense>
          </div>
        </div>
      </section>
    )
  )
}

const ModalContent = ({ children }: PropsWithChildren) => (
  <div className="bg-card text-card-foreground z-10 h-full max-h-[440px] w-full overflow-y-scroll rounded-sm p-5 whitespace-pre-line">
    {children}
  </div>
)

const ModalAction = ({ children }: PropsWithChildren) => (
  <div className="mt-5 flex w-full justify-end gap-4">{children}</div>
)

export { Modal, ModalAction, ModalContent }
