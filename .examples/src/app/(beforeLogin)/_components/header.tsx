import { LogoIcon } from '@/components/icon'
import { ThemeButton } from '@/components/theme-button'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export default function Header() {
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-b backdrop-blur">
      <div className="flex h-16 items-center justify-between px-8">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <LogoIcon className="size-10" />
            <span className="font-bold">Ansible Flow Editor</span>
          </Link>
        </div>
        <nav className="hidden items-center gap-6 md:flex">
          <Link
            href="#features"
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            Features
          </Link>
          <Link
            href="#how-it-works"
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            How It Works
          </Link>
          <Link
            href="#documentation"
            className="text-sm font-medium underline-offset-4 hover:underline"
          >
            Documentation
          </Link>
        </nav>
        <div className="flex items-center gap-4">
          <ThemeButton />
          <Button>
            <Link href="/auth/login">Login</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
