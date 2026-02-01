import { Button } from '@/components/ui/button'
import Link from 'next/link'
import NotFoundIcon from '../../public/errors/not-found.svg'

export default function NotFound() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-4">
      <div className="space-y-6 text-center">
        <div className="mx-auto h-50 w-50">
          <NotFoundIcon className="h-full w-full" />
        </div>
        <div className="space-y-4">
          <h1 className="text-muted-foreground text-3xl font-bold">
            페이지를 찾을 수 없습니다
          </h1>
          <p className="text-muted-foreground text-lg">
            요청하신 페이지는 존재하지 않거나 이동되었을 수 있습니다.
          </p>
        </div>
        <div className="flex justify-center gap-4">
          <Link href="/">
            <Button size="lg">홈으로 이동</Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            size="lg"
          >
            이전 페이지
          </Button>
        </div>
      </div>
    </div>
  )
}
