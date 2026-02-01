import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { Suspense } from 'react'
import ResetPasswordForm from '../_components/reset-password-form'

export default function ResetPasswordPage() {
  return (
    <div className="bg-background flex min-h-screen items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        <Suspense fallback={<Spinner />}>
          <Card>
            <CardHeader>
              <CardTitle>비밀번호 재설정</CardTitle>
              <CardDescription>
                새로운 비밀번호를 입력하시면 비밀번호가 재설정됩니다
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResetPasswordForm />
            </CardContent>
          </Card>
        </Suspense>
      </div>
    </div>
  )
}
