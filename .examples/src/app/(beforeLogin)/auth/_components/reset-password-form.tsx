'use client'

import FormInput from '@/components/form-input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import logger from '@/lib/logger'
import { resetPassword } from '@/services/auth/api/reset-password'
import { zodResolver } from '@hookform/resolvers/zod'
import { Lock } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'

const ResetPasswordSchema = z
  .object({
    password: z
      .string({ error: (issue) => issue.input === undefined ? '새 비밀번호를 입력하여 주세요' : '형식이 맞지 않습니다' })
      .min(8, '비밀번호는 최소 8자 이상이어야 합니다'),
    passwordConfirm: z.string({
      error: (issue) => issue.input === undefined ? '비밀번호 확인을 입력하여 주세요' : '형식이 맞지 않습니다',
    }),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다',
    path: ['confirmPassword'],
  })

type ResetPassword = z.infer<typeof ResetPasswordSchema>

export default function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const {
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ResetPassword>({
    resolver: zodResolver(ResetPasswordSchema),
  })

  if (!token) {
    return (
      <p className="text-red-500">
        비밀번호 재설정 토큰이 유효하지 않습니다. 다시 시도해 주세요.
      </p>
    )
  }

  const handleFormSubmit = async (data: ResetPassword) => {
    try {
      await resetPassword({ token, ...data })
      toast('비밀번호가 성공적으로 변경되었습니다.')
      router.replace('/auth/login')
    } catch (error) {
      logger.error('비밀번호 재설정 실패:', error)
    }
  }
  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="password">새 비밀번호</Label>
          <div className="relative">
            <Lock className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
            <FormInput
              control={control}
              name="password"
              type="password"
              className="pl-10"
              placeholder="새 비밀번호를 입력하세요"
              required
            />
            {errors.password && (
              <p className="error-msg">{errors.password.message}</p>
            )}
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="confirmPassword">비밀번호 확인</Label>
          <div className="relative">
            <Lock className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
            <FormInput
              control={control}
              name="passwordConfirm"
              type="password"
              className="pl-10"
              placeholder="비밀번호를 다시 입력하세요"
              required
            />
            {errors.passwordConfirm && (
              <p className="error-msg">{errors.passwordConfirm.message}</p>
            )}
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? '변경 중...' : '비밀번호 변경'}
        </Button>
      </div>
    </form>
  )
}
