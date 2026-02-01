'use client'

import { Button } from '@/components/ui/button'
import { useEffect } from 'react'
import InternalErrorIcon from '../../public/errors/internal-error.svg'

export default function Error({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string }
  reset: () => void
}>) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-4">
      <div className="space-y-6 text-center">
        <div className="mx-auto h-50 w-50">
          <InternalErrorIcon className="h-full w-full" />
        </div>
        <div className="space-y-4">
          <h1 className="text-destructive text-3xl font-bold">
            내부 오류가 발생했습니다
          </h1>
          <p className="text-muted-foreground text-lg">
            예상치 못한 오류가 발생했습니다. 다시 시도해주세요.
          </p>
        </div>
        <div className="flex justify-center gap-4">
          <Button onClick={reset} size="lg">
            다시 시도
          </Button>
          <Button
            variant="outline"
            onClick={() => (window.location.href = '/')}
            size="lg"
          >
            홈으로 이동
          </Button>
        </div>
      </div>
    </div>
  )
}
