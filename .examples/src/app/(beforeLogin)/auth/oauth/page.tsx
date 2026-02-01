'use client'

import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/contexts'
import { setToken } from '@/services'
import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect } from 'react'

export default function OAuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { checkAuth } = useAuth()

  useEffect(() => {
    const token = searchParams.get('token')

    if (token) {
      setToken({ accessToken: token })
      checkAuth()
      router.replace('/projects')
    } else {
      router.push('/')
    }
  }, [])

  return (
    <div className="flex h-full w-full items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}
