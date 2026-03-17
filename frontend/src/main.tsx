import React from 'react'
import {createRoot} from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import { OverlayProvider } from 'overlay-kit'
import { RouterProvider } from '@tanstack/react-router'
import './index.css'
import './style.css'
import { router } from './router'

const container = document.getElementById('root')

const root = createRoot(container!)

root.render(
    <React.StrictMode>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            storageKey="sipflow-theme"
            themes={['light', 'dark']}
        >
            <OverlayProvider>
                <RouterProvider router={router} />
            </OverlayProvider>
        </ThemeProvider>
    </React.StrictMode>
)
