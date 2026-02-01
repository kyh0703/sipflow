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
import ForgotPasswordForm from '../_components/forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <Suspense fallback={<Spinner />}>
          <Card>
            <CardHeader>
              <CardTitle>비밀번호 찾기</CardTitle>
              <CardDescription>
                가입하신 이메일 주소를 입력하시면 비밀번호 재설정 링크를
                보내드립니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ForgotPasswordForm />
            </CardContent>
            <CardFooter className="flex w-full items-center justify-center">
              <Button variant="link" className="text-lg">
                <Link href="/auth/login">로그인으로 돌아가기</Link>
              </Button>
            </CardFooter>
          </Card>
        </Suspense>
      </div>
    </div>
  )
}
