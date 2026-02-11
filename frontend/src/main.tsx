import React from 'react'
import {createRoot} from 'react-dom/client'
import { ThemeProvider } from 'next-themes'
import './index.css'
import './style.css'
import App from './App'

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
            <App/>
        </ThemeProvider>
    </React.StrictMode>
)
