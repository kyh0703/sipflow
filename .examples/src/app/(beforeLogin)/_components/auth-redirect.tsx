'use client'

import { useAuth } from '@/contexts'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export function AuthRedirect() {
  const router = useRouter()
  const { authUser } = useAuth()

  useEffect(() => {
    if (authUser) {
      router.push('/projects')
    }
  }, [authUser])

  return null
}
