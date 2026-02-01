'use client'

import FormInput from '@/components/form-input'
import { Button } from '@/components/ui/button'
import logger from '@/lib/logger'
import { setToken } from '@/services'
import { login } from '@/services/auth'
import { extractErrorMessage } from '@/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import * as z from 'zod'
import OAuthButton from './oauth-button'
import Link from 'next/link'
import { useAuth } from '@/contexts'

const LoginSchema = z.object({
  email: z.email(),
  password: z
    .string({
      error: (issue) =>
        issue.input === undefined
          ? '패스워드를 입력하여 주세요'
          : '형식이 맞지 않습니다',
    })
    .min(8, '비밀번호는 8자 이상이어야 합니다.')
    .max(32, '비밀번호는 32자 이하여야 합니다.'),
})

type Login = z.infer<typeof LoginSchema>

export function LoginForm() {
  const router = useRouter()
  const { checkAuth } = useAuth()

  const {
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<Login>({
    resolver: zodResolver(LoginSchema),
  })

  const onSubmit = async (data: Login) => {
    try {
      const response = await login(data)
      setToken(response)
      await checkAuth()
      router.replace('/projects')
      toast.success('로그인되었습니다')
    } catch (error) {
      toast.error(extractErrorMessage(error))
      logger.error(error)
    }
  }

  return (
    <form
      className="flex flex-col items-center justify-center space-y-4"
      onSubmit={handleSubmit(onSubmit)}
    >
      <FormInput
        control={control}
        name="email"
        className="rounded p-2"
        type="email"
        placeholder="아이디(이메일)"
      />
      {errors.email && <p className="error-msg">{errors.email.message}</p>}
      <FormInput
        control={control}
        className="rounded p-2"
        name="password"
        type="password"
        placeholder="비밀번호"
      />
      {errors.password && (
        <p className="error-msg">{errors.password.message}</p>
      )}
      <Button className="w-full" type="submit" disabled={isSubmitting}>
        {isSubmitting ? '로그인 중...' : '로그인'}
      </Button>
      <Button
        className="text-sm text-gray-500 hover:text-gray-700"
        variant="link"
      >
        <Link href="/auth/forgot-password">비밀번호를 잊으셨나요?</Link>
      </Button>
      <section className="flex gap-2">
        <OAuthButton />
      </section>
    </form>
  )
}
