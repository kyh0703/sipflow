'use client'

import { GithubIcon, GoogleIcon, KakaoIcon } from '@/components/icon'
import { Button } from '@/components/ui/button'
import { useEffect, useRef, useState } from 'react'

export default function OAuthButton() {
  const redirectURLRef = useRef('')
  const [mounted, setMounted] = useState(false)

  const handleGoogleLogin = () => {
    if (mounted) {
      window.location.href = `${process.env.NEXT_PUBLIC_API_BASE_PATH}/auth/google?redirect=${redirectURLRef.current}`
    }
  }

  const handleKakaoLogin = () => {
    if (mounted) {
      window.location.href = `${process.env.NEXT_PUBLIC_API_BASE_PATH}/auth/kakao?redirect=${redirectURLRef.current}`
    }
  }

  const handleGithubLogin = () => {
    if (mounted) {
      window.location.href = `${process.env.NEXT_PUBLIC_API_BASE_PATH}/auth/github?redirect=${redirectURLRef.current}`
    }
  }

  useEffect(() => {
    setMounted(true)
    redirectURLRef.current = encodeURIComponent(
      `${window.location.origin}/auth/oauth`,
    )
  }, [])

  return (
    <div className="space-y-3">
      <Button
        className="h-12 w-full text-base font-medium"
        variant="outline"
        type="button"
        onClick={handleGoogleLogin}
      >
        <GoogleIcon className="mr-3 size-4 flex-shrink-0" />
        구글로 로그인하기
      </Button>
      <Button
        className="h-12 w-full text-base font-medium"
        variant="outline"
        type="button"
        onClick={handleGithubLogin}
      >
        <GithubIcon className="mr-3 size-6 flex-shrink-0" />
        깃허브로 로그인하기
      </Button>
      <Button
        className="h-12 w-full text-base font-medium"
        variant="outline"
        type="button"
        onClick={handleKakaoLogin}
      >
        <KakaoIcon className="mr-3 size-4 flex-shrink-0" />
        카카오로 로그인하기
      </Button>
    </div>
  )
}
