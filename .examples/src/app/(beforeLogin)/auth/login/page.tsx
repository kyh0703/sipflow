import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import Link from 'next/link'
import { Suspense } from 'react'
import { LoginForm } from '../_components/login-form'

export default function LoginPage() {
  return (
    <div className="bg-background flex h-full w-full items-center justify-center px-4 py-12 text-base sm:px-6 lg:px-8">
      <Suspense fallback={<Spinner />}>
        <Card className="max-w-md space-y-8">
          <CardHeader>
            <CardTitle>로그인</CardTitle>
            <CardDescription>계정에 로그인하세요</CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
          <CardFooter className="flex w-full flex-col items-center justify-center">
            <Button variant="link" className="text-lg">
              <Link href="/auth/register">계정이 없으신가요? 회원가입</Link>
            </Button>
          </CardFooter>
        </Card>
      </Suspense>
    </div>
  )
}
