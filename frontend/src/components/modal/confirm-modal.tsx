import { overlay } from 'overlay-kit'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

import { Modal, ModalAction, ModalContent } from './modal'

type ConfirmModalProps = {
  content: string
  onClose?: (param: boolean) => void
}

export function ConfirmModal({
  content,
  onClose,
}: Readonly<ConfirmModalProps>) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        onClose?.(true)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  return (
    <>
      <ModalContent>{content}</ModalContent>
      <ModalAction>
        <Button variant="destructive" onClick={() => onClose?.(false)}>
          Cancel
        </Button>
        <Button onClick={() => onClose?.(true)}>OK</Button>
      </ModalAction>
    </>
  )
}

export const showConfirmModal = async (message: string): Promise<boolean> => {
  return overlay.openAsync<boolean>(({ isOpen, close, unmount }) => (
    <Modal isOpen={isOpen} onExit={unmount}>
      <ConfirmModal content={message} onClose={close} />
    </Modal>
  ))
}
