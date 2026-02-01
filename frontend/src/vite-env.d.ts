/// <reference types="vite/client" />

interface Window {
  runtime?: Record<string, (...args: unknown[]) => unknown>
}
