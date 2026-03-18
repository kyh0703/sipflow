import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ThemeToggle } from './theme-toggle'

const setTheme = vi.fn()

vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme,
  }),
}))

vi.mock('./dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuRadioGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuRadioItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

describe('ThemeToggle', () => {
  it('renders with run-button-like compact spacing', async () => {
    render(<ThemeToggle />)

    const button = await screen.findByRole('button', { name: /theme/i })

    expect(button).toHaveClass('h-9', 'rounded-md', 'px-3', 'text-sm')
  })
})
