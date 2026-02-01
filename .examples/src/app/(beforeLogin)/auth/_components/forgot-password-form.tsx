'use client'

import FormInput from '@/components/form-input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { forgotPassword } from '@/services/auth/api/forgot-password'
import { zodResolver } from '@hookform/resolvers/zod'
import { Mail } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'

const ForgotPasswordSchema = z.object({
  email: z.email({
    message: '이메일을 입력하여 주세요',
  }),
})

type ForgotPassword = z.infer<typeof ForgotPasswordSchema>

export default function ForgotPasswordForm() {
  const {
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ForgotPassword>({
    resolver: zodResolver(ForgotPasswordSchema),
  })

  const onSubmit = async (data: ForgotPassword) => {
    try {
      await forgotPassword(data)
      toast('비밀번호 재설정 링크가 이메일로 전송되었습니다.')
    } catch (error) {
      toast('비밀번호 재설정 요청에 실패했습니다. 다시 시도해 주세요.')
      console.error(error)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">이메일</Label>
          <div className="relative">
            <Mail className="text-muted-foreground absolute top-3 left-3 h-4 w-4" />
            <FormInput
              control={control}
              name="email"
              type="email"
              className="pl-10"
              placeholder="name@example.com"
              required
            />
            {errors.email && (
              <p className="error-msg">{errors.email.message}</p>
            )}
          </div>
        </div>
        <Button type="submit" className="w-full">
          비밀번호 재설정 링크 보내기
        </Button>
      </div>
    </form>
  )
}
