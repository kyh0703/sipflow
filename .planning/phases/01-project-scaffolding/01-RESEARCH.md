# Phase 01: Project Scaffolding and Basic Structure - Research

**Researched:** 2026-02-09
**Domain:** Wails v2 Desktop Framework, Go Backend Structure, React + TypeScript + Tailwind v4 + shadcn/ui Frontend
**Confidence:** HIGH

## Summary

This research covers how to properly scaffold a Wails v2 desktop application with a modern frontend stack (React 18 + TypeScript + Tailwind CSS v4 + shadcn/ui) and structured Go backend. The primary challenge is orchestrating multiple setup steps in the correct order: Wails project initialization, Go package structure, frontend tooling configuration, and binding verification.

Wails v2.9.x provides a mature template system with `wails init -t react-ts` that generates a Vite-based React + TypeScript project. However, Tailwind CSS v4 requires manual integration using the new `@tailwindcss/vite` plugin and CSS-based configuration (no more `tailwind.config.js`). The shadcn/ui component library expects specific path aliases and TypeScript configuration.

On the Go side, the standard practice is to use `internal/` packages for application-specific code that shouldn't be importable by external modules. The Wails runtime requires careful context management through the `OnStartup` lifecycle hook. The `embed.FS` pattern bundles frontend assets into the Go binary for production builds.

**Key Recommendation:** Follow the initialization sequence: Wails project → Go package structure → Tailwind v4 + shadcn/ui → dependency installation → binding verification. Test Go↔React communication early with a ping/pong pattern to catch binding issues before building complex features.

## Standard Stack

Core technologies for Wails v2 + React + TypeScript desktop applications:

### Core

| Library | Version | Purpose | Why It's Standard |
|---------|---------|---------|-------------------|
| Wails | v2.9.x | Desktop framework (Go + WebView) | Official framework for Go-based desktop apps, single binary output, native performance |
| Go | 1.23+ | Backend runtime | Required by Wails v2, latest stable supports generics and improved toolchain |
| React | 18.x | Frontend framework | Bundled in official `react-ts` template, mature ecosystem |
| TypeScript | 5.x | Type safety | Default in Wails react-ts template, prevents runtime errors |
| Vite | 5.x | Build tool | Default bundler in Wails v2, fast HMR, modern ESM-based |

**Installation:**
```bash
# Install Wails CLI (requires Go 1.23+)
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Verify installation
wails doctor

# Initialize project with React + TypeScript template
wails init -n sipflow -t react-ts

# Alternative: use community template with Tailwind pre-configured
# wails init -n sipflow -t https://github.com/Mahcks/wails-vite-react-tailwind-shadcnui-ts
```

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | v4.x | Utility-first CSS | Modern styling, required for shadcn/ui |
| @tailwindcss/vite | latest | Vite plugin for Tailwind v4 | Mandatory for Tailwind v4 integration |
| shadcn/ui | latest | React component library | Pre-built accessible UI components |
| @xyflow/react | 12.x | Node-based editor | SIP scenario builder (main feature) |
| Zustand | 5.x | State management | Recommended by XYFlow for flow state |
| emiago/diago | latest | SIP library for Go | SIP protocol implementation |

**Installation:**
```bash
# Frontend dependencies (in frontend/)
cd frontend
npm install @xyflow/react zustand
npm install tailwindcss @tailwindcss/vite

# shadcn/ui setup (creates components.json)
npx shadcn@latest init

# Go dependencies (in project root)
cd ..
go get github.com/emiago/diago
go mod tidy
```

### Alternatives Considered

| Instead of | Alternative | Tradeoff |
|------------|-------------|----------|
| Wails | Electron | Wails: smaller binaries (~15MB vs ~100MB), Go backend; Electron: larger ecosystem, Node.js backend |
| Wails | Tauri | Wails: Go backend, simpler; Tauri: Rust backend, more security features |
| Tailwind v4 | Tailwind v3 | v4: CSS config, faster builds, modern features; v3: JS config, wider compatibility |
| shadcn/ui | Radix UI directly | shadcn: copy-paste components, customizable; Radix: installable package, less customization |

## Architecture Patterns

### Recommended Project Structure

```
sipflow/
├── main.go                    # Application entry point, Wails.Run()
├── app.go                     # Main app struct with OnStartup, OnShutdown
├── wails.json                 # Wails project configuration
├── go.mod                     # Go module definition
├── go.sum                     # Go dependency checksums (commit to git)
├── build/                     # Build configuration
│   └── appicon.png           # Application icon
├── frontend/                  # React + TypeScript frontend
│   ├── src/
│   │   ├── main.tsx          # React entry point
│   │   ├── App.tsx           # Root component
│   │   ├── index.css         # Tailwind imports (@import "tailwindcss")
│   │   ├── components/       # UI components
│   │   ├── features/         # Feature modules (scenario-builder, etc.)
│   │   └── lib/              # Utilities
│   ├── dist/                 # Build output (embedded via embed.FS)
│   ├── wailsjs/              # Auto-generated Go↔JS bindings (DO NOT EDIT)
│   │   ├── go/               # TypeScript wrappers for Go methods
│   │   └── runtime/          # Wails runtime methods
│   ├── vite.config.ts        # Vite configuration (add @tailwindcss/vite plugin)
│   ├── tsconfig.json         # TypeScript config (add path aliases)
│   ├── tsconfig.app.json     # App-specific TS config (add path aliases)
│   ├── components.json       # shadcn/ui configuration
│   └── package.json
└── internal/                  # Go internal packages (not importable externally)
    ├── engine/               # SIP engine (diago instances)
    ├── scenario/             # Scenario execution logic
    └── binding/              # Wails binding structs
```

### Pattern 1: Wails Application Lifecycle

**Description:** Wails apps use lifecycle hooks on a main app struct for initialization and cleanup.

**When to Use:** Every Wails application requires this pattern.

**Example:**
```go
// app.go
package main

import (
    "context"
    "github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
    ctx context.Context
}

func NewApp() *App {
    return &App{}
}

// OnStartup is called when the app starts. The context is saved
// so we can call runtime methods.
func (a *App) OnStartup(ctx context.Context) {
    a.ctx = ctx
    runtime.LogInfo(ctx, "Application started")
}

// OnShutdown is called when the application is terminating
func (a *App) OnShutdown(ctx context.Context) {
    runtime.LogInfo(ctx, "Application shutting down")
}

// Greet is a method that will be exposed to the frontend
func (a *App) Greet(name string) string {
    return "Hello " + name
}
```

```go
// main.go
package main

import (
    "embed"
    "github.com/wailsapp/wails/v2"
    "github.com/wailsapp/wails/v2/pkg/options"
    "github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
    app := NewApp()

    err := wails.Run(&options.App{
        Title:  "sipflow",
        Width:  1024,
        Height: 768,
        AssetServer: &assetserver.Options{
            Assets: assets,
        },
        OnStartup:  app.OnStartup,
        OnShutdown: app.OnShutdown,
        Bind: []interface{}{
            app,
        },
    })

    if err != nil {
        println("Error:", err.Error())
    }
}
```

### Pattern 2: Multiple Binding Structs with Context

**Description:** Organize backend logic into multiple structs (e.g., EngineBinding, ScenarioBinding) and pass context from OnStartup.

**When to Use:** When you need to separate concerns across multiple Go packages.

**Example:**
```go
// app.go
package main

import (
    "context"
    "sipflow/internal/binding"
)

type App struct {
    ctx            context.Context
    engineBinding  *binding.EngineBinding
    scenarioBinding *binding.ScenarioBinding
}

func NewApp() *App {
    return &App{
        engineBinding:   binding.NewEngineBinding(),
        scenarioBinding: binding.NewScenarioBinding(),
    }
}

func (a *App) OnStartup(ctx context.Context) {
    a.ctx = ctx
    // Pass context to all bindings
    a.engineBinding.SetContext(ctx)
    a.scenarioBinding.SetContext(ctx)
}

// main.go
func main() {
    app := NewApp()
    err := wails.Run(&options.App{
        // ...
        Bind: []interface{}{
            app,
            app.engineBinding,
            app.scenarioBinding,
        },
    })
}
```

```go
// internal/binding/engine_binding.go
package binding

import (
    "context"
    "github.com/wailsapp/wails/v2/pkg/runtime"
)

type EngineBinding struct {
    ctx context.Context
}

func NewEngineBinding() *EngineBinding {
    return &EngineBinding{}
}

func (e *EngineBinding) SetContext(ctx context.Context) {
    e.ctx = ctx
}

// Ping method for binding verification
func (e *EngineBinding) Ping() string {
    runtime.LogInfo(e.ctx, "Ping received")
    return "pong"
}
```

### Pattern 3: Frontend Binding Usage (TypeScript)

**Description:** Wails generates TypeScript wrappers in `frontend/wailsjs/go/` for all bound Go methods.

**When to Use:** Every frontend call to Go backend methods.

**Example:**
```typescript
// frontend/src/App.tsx
import { Ping } from '../wailsjs/go/binding/EngineBinding'
import { useEffect, useState } from 'react'

function App() {
    const [status, setStatus] = useState<string>('')

    useEffect(() => {
        // Call Go method through generated binding
        Ping()
            .then(result => {
                setStatus(`Backend responded: ${result}`)
            })
            .catch(err => {
                setStatus(`Error: ${err}`)
            })
    }, [])

    return (
        <div className="p-4">
            <h1 className="text-2xl font-bold">Binding Test</h1>
            <p>{status}</p>
        </div>
    )
}

export default App
```

### Pattern 4: Tailwind CSS v4 Integration (CSS-based config)

**Description:** Tailwind v4 uses CSS imports instead of JavaScript config files.

**When to Use:** All new Tailwind v4 projects.

**Example:**
```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Add Tailwind v4 plugin
  ],
  resolve: {
    alias: {
      '@': '/src', // Path alias for shadcn/ui
    },
  },
})
```

```css
/* frontend/src/index.css */
@import "tailwindcss";

/* Optional: custom theme variables */
@theme {
  --color-primary: #3b82f6;
  --color-secondary: #64748b;
}
```

```json
// frontend/tsconfig.json (add baseUrl and paths)
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
    // ... other options
  }
}
```

### Anti-Patterns to Avoid

- **Don't edit `frontend/wailsjs/` manually**: Wails regenerates these files on every build. Changes will be overwritten.
- **Don't use `tailwind.config.js` in v4**: Tailwind v4 uses CSS-based configuration via `@theme` directive.
- **Don't forget to save context in OnStartup**: Runtime methods require the context passed to OnStartup. Losing this context prevents calling runtime functions.
- **Don't skip `go mod tidy`**: This command is essential for removing unused dependencies and ensuring reproducible builds.
- **Don't use `stroke-dasharray` for edge animations**: Use SVG `animateMotion` instead for better performance (see XYFlow research).

## Don't Hand-Roll

Simple-looking problems with existing solutions in the Wails/Go/React ecosystem:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SIP protocol implementation | Custom SIP parser/handler | `emiago/diago` | SIP is complex (INVITE, ACK, BYE, CANCEL, state machines, RTP, codecs). Diago handles all of this. |
| File dialogs (open/save) | Custom HTML file input | `runtime.OpenFileDialog`, `runtime.SaveFileDialog` | Native OS dialogs provide better UX and security. |
| System notifications | Browser Notification API | `runtime.MessageDialog`, `runtime.EventsEmit` | Desktop apps should use native dialogs for critical messages. |
| Window drag area | JavaScript mouse event handlers | CSS `--wails-draggable` | Wails provides a declarative CSS solution that's more reliable. |
| TypeScript types for Go methods | Manual type definitions | Wails auto-generated bindings | Wails generates accurate types from Go method signatures automatically. |
| Node-based flow editor | Custom canvas + SVG logic | `@xyflow/react` | Flow editors require pan/zoom, drag-drop, edge routing, selection, serialization. XYFlow is battle-tested. |
| UI components (buttons, dialogs, forms) | Custom React components | `shadcn/ui` | Pre-built, accessible, customizable components save weeks of work. |

**Key Insight:** Wails provides a comprehensive runtime API for desktop features (dialogs, events, logging, clipboard, etc.). Use these instead of trying to replicate desktop functionality with web APIs.

## Common Pitfalls

### Pitfall 1: Windows Hot Reload Issues

**What Happens:** On Windows, `wails dev` hot reload can be unstable, causing the app to hang or fail to reload after changes.

**Why It Happens:** Known limitation in Wails v2 on Windows (documented in STATE.md). The file watcher and WebView interaction can conflict.

**How to Avoid:**
- Develop on Linux if possible (hot reload is stable)
- On Windows, manually restart `wails dev` when changes don't apply
- Use `wails build -debug` for testing instead of `wails dev` if hot reload is problematic

**Warning Signs:**
- App window becomes unresponsive after file changes
- Console shows WebView errors or crashes
- Changes to Go files don't trigger rebuild

### Pitfall 2: Missing Path Aliases for shadcn/ui

**What Happens:** After running `npx shadcn@latest init`, components fail to import with errors like `Cannot find module '@/components/ui/button'`.

**Why It Happens:** shadcn/ui expects `@/*` path alias to be configured in both `tsconfig.json` and `vite.config.ts`. The default Wails template doesn't include this.

**How to Avoid:**
```json
// frontend/tsconfig.json AND frontend/tsconfig.app.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

```typescript
// frontend/vite.config.ts
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Warning Signs:**
- TypeScript errors: `Cannot find module '@/components/...'`
- shadcn components fail to import
- Vite build fails with path resolution errors

### Pitfall 3: Forgetting `go mod tidy` After Adding Dependencies

**What Happens:** Build fails with missing module errors, or `go.mod` contains unused dependencies causing bloat.

**Why It Happens:** `go get` adds dependencies to `go.mod`, but doesn't remove unused ones. Over time, this creates drift between actual imports and `go.mod` entries.

**How to Avoid:**
- Run `go mod tidy` after every `go get` command
- Add to workflow: `go get <package> && go mod tidy`
- Commit both `go.mod` AND `go.sum` to version control

**Warning Signs:**
- Build errors: `missing go.sum entry for module`
- `go.mod` lists packages not imported anywhere
- CI/CD build fails with different dependencies than local

### Pitfall 4: Context Not Saved in OnStartup

**What Happens:** Calling `runtime.*` methods panics with nil context errors.

**Why It Happens:** The `context.Context` passed to `OnStartup` is required for all runtime methods. If not saved to a struct field, it's lost.

**How to Avoid:**
```go
type App struct {
    ctx context.Context // CRITICAL: save this in OnStartup
}

func (a *App) OnStartup(ctx context.Context) {
    a.ctx = ctx // Don't forget this line
}

func (a *App) SomeMethod() {
    // Now safe to use a.ctx
    runtime.LogInfo(a.ctx, "This works")
}
```

**Warning Signs:**
- Panic: `invalid memory address or nil pointer dereference`
- Runtime methods fail silently
- Logs, events, or dialogs don't work

### Pitfall 5: Editing Auto-Generated Bindings

**What Happens:** Manual edits to `frontend/wailsjs/go/*` are overwritten on next build, causing confusion and lost work.

**Why It Happens:** Wails regenerates these files from Go method signatures during `wails dev` and `wails build`. It's not designed for manual editing.

**How to Avoid:**
- Never edit files in `frontend/wailsjs/`
- If types are wrong, fix the Go method signature instead
- Add `frontend/wailsjs/` to `.gitignore` if desired (though committing can help catch binding changes)

**Warning Signs:**
- Changes in `wailsjs/` disappear after restart
- Git shows constant changes in `wailsjs/` files
- TypeScript types don't match Go method signatures

### Pitfall 6: Wrong Tailwind v4 Setup (using v3 approach)

**What Happens:** Tailwind classes don't work, build errors about missing PostCSS config.

**Why It Happens:** Tailwind v4 is fundamentally different from v3. The v3 setup guide (with `tailwind.config.js` and PostCSS) doesn't work.

**How to Avoid:**
- Don't create `tailwind.config.js` (v4 uses CSS config)
- Don't install `postcss` or `autoprefixer` separately
- Use `@import "tailwindcss"` in CSS (not `@tailwind base/components/utilities`)
- Install `@tailwindcss/vite` plugin and add to `vite.config.ts`

**Warning Signs:**
- Error: `Cannot find module 'tailwindcss/defaultTheme'`
- Tailwind classes render as plain text (no styles applied)
- Vite build fails with PostCSS errors

## Code Examples

Official patterns validated from Wails documentation and community templates:

### Basic Wails Project Initialization

```bash
# Source: https://wails.io/docs/reference/cli/
# Verify prerequisites
go version  # Should be 1.23+
wails doctor  # Checks for all dependencies

# Initialize project with React + TypeScript template
wails init -n sipflow -t react-ts -d /path/to/project

# Navigate and verify structure
cd sipflow
ls -la
# Expected: main.go, app.go, wails.json, frontend/, build/

# Install frontend dependencies
cd frontend
npm install

# Return to root and run in dev mode
cd ..
wails dev
```

### Complete Tailwind v4 + shadcn/ui Setup

```bash
# Source: https://tailwindcss.com/blog/tailwindcss-v4
# https://ui.shadcn.com/docs/installation/vite

# In frontend/ directory
cd frontend

# Install Tailwind v4
npm install tailwindcss @tailwindcss/vite

# Initialize shadcn/ui (creates components.json)
npx shadcn@latest init
# Select:
# - TypeScript: yes
# - Style: Default
# - Base color: Slate (or preferred)
# - CSS variables: yes
```

```typescript
// frontend/vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Tailwind v4 plugin
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'), // For shadcn/ui
    },
  },
})
```

```css
/* frontend/src/index.css */
@import "tailwindcss";
```

```json
// frontend/tsconfig.json (add to compilerOptions)
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

// frontend/tsconfig.app.json (add to compilerOptions)
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

### Go Package Structure Setup

```bash
# Source: https://github.com/golang-standards/project-layout
# Internal packages pattern

# Create internal package structure
mkdir -p internal/engine
mkdir -p internal/scenario
mkdir -p internal/binding

# Add diago dependency
go get github.com/emiago/diago
go mod tidy
```

```go
// internal/binding/engine_binding.go
package binding

import (
    "context"
    "github.com/wailsapp/wails/v2/pkg/runtime"
)

type EngineBinding struct {
    ctx context.Context
}

func NewEngineBinding() *EngineBinding {
    return &EngineBinding{}
}

func (e *EngineBinding) SetContext(ctx context.Context) {
    e.ctx = ctx
}

// Ping method for testing Go↔React binding
func (e *EngineBinding) Ping() string {
    runtime.LogInfo(e.ctx, "Ping received from frontend")
    return "pong"
}

// GetVersion returns the engine version
func (e *EngineBinding) GetVersion() string {
    return "0.1.0"
}
```

```go
// app.go
package main

import (
    "context"
    "sipflow/internal/binding"
)

type App struct {
    ctx           context.Context
    engineBinding *binding.EngineBinding
}

func NewApp() *App {
    return &App{
        engineBinding: binding.NewEngineBinding(),
    }
}

func (a *App) OnStartup(ctx context.Context) {
    a.ctx = ctx
    a.engineBinding.SetContext(ctx)
}

func (a *App) OnShutdown(ctx context.Context) {
    // Cleanup logic here
}
```

```go
// main.go
package main

import (
    "embed"
    "github.com/wailsapp/wails/v2"
    "github.com/wailsapp/wails/v2/pkg/options"
    "github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
    app := NewApp()

    err := wails.Run(&options.App{
        Title:  "sipflow",
        Width:  1280,
        Height: 800,
        AssetServer: &assetserver.Options{
            Assets: assets,
        },
        OnStartup:  app.OnStartup,
        OnShutdown: app.OnShutdown,
        Bind: []interface{}{
            app.engineBinding, // Bind EngineBinding methods to frontend
        },
    })

    if err != nil {
        println("Error:", err.Error())
    }
}
```

### Frontend Binding Verification (Ping/Pong Test)

```typescript
// frontend/src/App.tsx
import { useEffect, useState } from 'react'
import { Ping, GetVersion } from '../wailsjs/go/binding/EngineBinding'

function App() {
    const [status, setStatus] = useState<string>('Testing...')
    const [version, setVersion] = useState<string>('')

    useEffect(() => {
        // Test Go↔React binding
        Promise.all([
            Ping(),
            GetVersion(),
        ])
        .then(([pingResult, versionResult]) => {
            setStatus(`✓ Backend responded: ${pingResult}`)
            setVersion(versionResult)
        })
        .catch(err => {
            setStatus(`✗ Binding error: ${err}`)
        })
    }, [])

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-50">
            <div className="p-8 bg-white rounded-lg shadow-lg">
                <h1 className="text-3xl font-bold text-gray-900 mb-4">
                    Wails + React Binding Test
                </h1>
                <p className="text-lg text-gray-700 mb-2">{status}</p>
                <p className="text-sm text-gray-500">Version: {version}</p>
            </div>
        </div>
    )
}

export default App
```

## State of the Art

Evolution of Wails and related technologies:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Wails v1 | Wails v2 | 2022-09 | v2 removed `project.json`, added `wails.json`. Runtime moved to separate package. Only structs bindable (not functions). |
| Tailwind v3 (JS config) | Tailwind v4 (CSS config) | 2024-12 | v4 uses `@import "tailwindcss"` and `@theme` directive. No more `tailwind.config.js` or PostCSS setup. 5x faster builds. |
| reactflow | @xyflow/react | 2024 (v12) | Package renamed, improved TypeScript support, SSR/SSG compatibility. |
| PostCSS + autoprefixer | Lightning CSS (built into Tailwind v4) | 2024-12 | Automatic CSS optimization without separate PostCSS config. |
| Manual TypeScript bindings | Wails auto-generated bindings | Wails v2 | TypeScript types generated from Go signatures automatically via `wailsjs/`. |

**Deprecated/Obsolete:**
- **Wails v1 WailsInit pattern**: Replaced with `OnStartup(ctx context.Context)` method in v2.
- **Tailwind v3 setup with `npx tailwindcss init`**: v4 uses CSS imports, no config file needed.
- **`@tailwind base; @tailwind components; @tailwind utilities;`**: v4 uses `@import "tailwindcss";`.
- **Go 1.18-1.22 without toolchain directive**: Go modules now use `toolchain` directive in `go.mod` for consistent builds.

## Open Questions

Issues that could not be fully resolved during research:

1. **Wails v2 Windows hot reload stability timeline**
   - Known: Windows hot reload is unstable (documented in Wails v2 beta announcements, STATE.md)
   - Unclear: Is this fixed in v2.9.x, or should we expect it in v3? No definitive answer in recent changelogs.
   - Recommendation: Develop on Linux for Phase 01. Document Windows workarounds (manual restart) if team members use Windows.

2. **Tailwind CSS v4 browser compatibility verification**
   - Known: v4 targets Safari 16.4+, Chrome 111+, Firefox 128+ (uses `@property`, `color-mix()`)
   - Unclear: Wails uses WebView (Chromium-based on Linux, WebKit on macOS, Edge WebView2 on Windows). Are all platforms guaranteed to support Tailwind v4 features?
   - Recommendation: Test Tailwind v4 features (custom properties, color-mix) in `wails dev` early on target platforms.

3. **shadcn/ui compatibility with Wails WebView**
   - Known: shadcn/ui works with standard React + Vite setups
   - Unclear: Are there known issues with Radix UI primitives (used by shadcn) in Wails WebView? No documented issues found.
   - Recommendation: Add a shadcn button component in Phase 01 to verify compatibility before building complex UI.

4. **Optimal `internal/` package granularity for MVP scope**
   - Known: Go best practice is to avoid over-nesting, use shallow hierarchies
   - Unclear: Should we start with `internal/engine`, `internal/scenario`, `internal/binding` or consolidate further?
   - Recommendation: Start with three packages as planned. Refactor if boundaries become unclear during implementation.

## Sources

### Primary (HIGH Confidence)

**Wails v2 Documentation:**
- [Creating a Project | Wails](https://wails.io/docs/gettingstarted/firstproject/) - Official project initialization guide
- [Application Development | Wails](https://wails.io/docs/guides/application-development/) - Binding and development patterns
- [CLI Reference | Wails](https://wails.io/docs/reference/cli/) - `wails init` command flags
- [Runtime Introduction | Wails](https://wails.io/docs/reference/runtime/intro/) - Runtime package context usage
- [Troubleshooting | Wails](https://wails.io/docs/guides/troubleshooting/) - Common issues

**Tailwind CSS v4:**
- [Tailwind CSS v4.0 Announcement](https://tailwindcss.com/blog/tailwindcss-v4) - Official v4 release notes
- [Vite Installation Guide - shadcn/ui](https://ui.shadcn.com/docs/installation/vite) - shadcn setup with Tailwind v4

**Go Best Practices:**
- [Managing Dependencies - Go Official](https://go.dev/doc/modules/managing-dependencies) - `go mod tidy`, `go get` patterns
- [golang-standards/project-layout](https://github.com/golang-standards/project-layout) - Standard Go project structure

**Previously Conducted Research:**
- `.planning/research/SUMMARY.md` - Initial domain research (Wails, diago, XYFlow)
- `.planning/research/xyflow-react-flow.md` - Detailed XYFlow v12 patterns

### Secondary (MEDIUM Confidence)

**Community Templates & Tutorials:**
- [Introduction to Wails - Project Structure](https://thedevelopercafe.com/articles/introduction-to-wails-build-desktop-apps-with-go-project-structure-17ee3f7fcdf7) - Wails architecture overview
- [Mapping Success: Building a Tracking App with Wails](https://medium.com/@tomronw/mapping-success-building-a-simple-tracking-desktop-app-with-go-react-and-wails-ac83dbcbccca) - Real-world binding patterns
- [Best Practice: How to Structure a Complex App?](https://github.com/wailsapp/wails/discussions/909) - Community discussion on Go package structure
- [How to Use Shadcn UI in Your React + Vite Project](https://dev.to/sudhanshudevelopers/how-to-use-shadcn-ui-in-your-react-vite-project-5g0h) - shadcn setup guide

**Go Module Management (2026):**
- [Mastering go.mod: Dependency Management the Right Way](https://medium.com/@moksh.9/mastering-go-mod-dependency-management-the-right-way-in-go-918226a69d58) - go mod best practices
- [How to Use Go Modules for Dependency Management](https://oneuptime.com/blog/post/2026-01-23-go-modules-dependency/view) - Recent 2026 guide
- [Mastering Go Modules: Best Practices for Dependency Management](https://codezup.com/mastering-go-modules-best-practices/) - Comprehensive best practices

### Tertiary (LOW Confidence - Context Filling)

**Installation & Setup:**
- [Install Tailwind CSS with Vite (v4 Plugin Guide)](https://tailkits.com/blog/install-tailwind-css-with-vite/) - Vite plugin configuration
- [How to install Tailwind v4 in a Vite project](https://dev.to/goldenekpendu/how-to-install-tailwind-v4-in-a-vite-project-g3d) - Setup walkthrough

## Metadata

**Confidence Breakdown:**
- Standard Stack: HIGH - All libraries verified from official docs and package registries
- Architecture Patterns: HIGH - Patterns from Wails official docs and golang-standards
- Pitfalls: MEDIUM-HIGH - Mix of official troubleshooting docs and community experience
- Code Examples: HIGH - Derived from official Wails templates and documentation

**Research Date:** 2026-02-09
**Validity Period:** 30 days (Wails and Tailwind are stable; re-verify if new major versions release)
