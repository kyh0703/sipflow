# Technology Stack

**Project:** SIPFlow - SIP Call Flow Designer
**Researched:** 2026-02-01
**Overall Confidence:** HIGH

## Executive Summary

The user-selected stack (Go + Wails v2, React + Vite + xyflow, diago, SQLite) is well-validated for 2026. This research enriches those choices with specific versions, complementary libraries, and rationale. The stack provides a cgo-free, cross-platform desktop app with embedded SIP capabilities and visual flow editing.

## Core Framework Stack

### Desktop Application Framework

| Technology | Version | Purpose | Rationale | Confidence |
|------------|---------|---------|-----------|------------|
| **Wails** | v2.10 | Desktop app framework (Go backend + Web frontend) | Latest stable release (Feb 2025). Seamless Go-React bindings via automatic code generation. No cgo required. Native OS webview (no Chromium bundle). Mature v2 with production track record. v3 is alpha-only. | **HIGH** |
| **Go** | 1.21+ | Backend runtime and SIP engine | Required by Wails v2.10. Modern Go with generics support. Native concurrency for SIP message handling. | **HIGH** |

**Why Wails v2 over v3:**
- v2.10 (Feb 2025) is latest stable production release
- v3 is nightly alpha builds only as of Feb 2026
- v2 has mature ecosystem and proven stability
- Migration path to v3 available when it stabilizes

**Sources:**
- [Wails Changelog](https://wails.io/changelog/)
- [Wails v2 Releases](https://github.com/wailsapp/wails/releases)

### Frontend Stack

| Technology | Version | Purpose | Rationale | Confidence |
|------------|---------|---------|-----------|------------|
| **React** | 19.2.4 | UI framework | Latest stable (Jan 2026) with security updates. forwardRef removed (cleaner APIs). Compiler support. Wails v2 has first-class React template. | **HIGH** |
| **Vite** | 6.x | Build tool and dev server | Vite 6 released with React 19 compatibility. Lightning-fast HMR for development. Wails v2 uses Vite by default. Node 20.19+ or 22.12+ required. | **HIGH** |
| **TypeScript** | 5.7+ | Type safety | Standard for 2026 React development. Wails auto-generates TS bindings from Go structs. End-to-end type safety from backend to frontend. | **HIGH** |
| **@xyflow/react** | 12.10.0 | Visual flow editor | Renamed from reactflow. Latest version (Jan 2026). SSR/SSG support. Framework-agnostic @xyflow/system core. Highly customizable nodes/edges. Perfect for SIP flow canvas. | **HIGH** |

**Why React 19:**
- Stable as of Dec 2024, battle-tested through 2025
- Removes forwardRef boilerplate (cleaner custom nodes)
- Compiler optimizations for complex flow graphs
- Vite 6 has verified compatibility

**Why @xyflow/react 12:**
- Rebranded from reactflow (same team, better structure)
- SSR support enables future web version
- Performance improvements for large flows (100+ nodes)
- Rich ecosystem of examples for custom nodes

**Sources:**
- [React v19](https://react.dev/blog/2024/12/05/react-19)
- [React 19.2 Release](https://react.dev/blog/2025/10/01/react-19-2)
- [xyflow npm package](https://www.npmjs.com/package/@xyflow/react)
- [Vite 6 React 19 Compatibility](https://www.thecandidstartup.org/2025/03/31/vitest-3-vite-6-react-19.html)

### SIP Engine Stack

| Technology | Version | Purpose | Rationale | Confidence |
|------------|---------|---------|-----------|------------|
| **diago** | v0.26.0 | SIP User Agent library | Latest release (Jan 27, 2026) with SRTP DTLS support. Built on sipgo. Full dialog control (client/server). RTP/RTCP support. DTMF support. Authentication and registration. Actively maintained (357 stars, 63 forks). | **HIGH** |
| **sipgo** | Latest | SIP stack and proxy | Underlying library for diago. RFC 3261/3581/6026 compliant. Fast parsing optimized. Includes proxy example (example/proxysip). Can build embedded SIP proxy. Same author as diago (ecosystem coherence). | **HIGH** |

**Why diago over raw sipgo:**
- sipgo is low-level SIP stack (transactions, parsing)
- diago adds high-level dialog/session management
- diago includes RTP/RTCP media handling (needed for full UA simulation)
- diago provides authentication and registration
- User already selected diago, research validates this choice

**Embedded SIP Proxy Strategy:**
- Use sipgo directly for embedded proxy (diago is for UA instances)
- sipgo example/proxysip shows stateful proxy implementation
- Proxy routes between UA instances and external SIP servers
- Same codebase ecosystem (emiago author)

**Sources:**
- [diago GitHub](https://github.com/emiago/diago)
- [sipgo GitHub](https://github.com/emiago/sipgo)
- [sipgo proxy example](https://pkg.go.dev/github.com/shend/sipgo/example/proxysip)

### Database Stack

| Technology | Version | Purpose | Rationale | Confidence |
|------------|---------|---------|-----------|------------|
| **SQLite** | 3.51.2 | Flow persistence | Embedded database, no server required. Single-file storage (portable projects). Standard for desktop apps. | **HIGH** |
| **modernc.org/sqlite** | v1.36.0+ | Go SQLite driver | Latest: Jan 20, 2026. **CGO-FREE** (critical for Wails cross-compilation). Pure Go implementation. 2-10x slower than mattn/go-sqlite3 but acceptable for flow storage (not high-frequency). Avoids C compiler requirement on build machines. | **HIGH** |

**Why modernc.org/sqlite over mattn/go-sqlite3:**

| Criterion | modernc.org/sqlite | mattn/go-sqlite3 |
|-----------|-------------------|------------------|
| **Cross-compilation** | Easy (pure Go) | Hard (requires cgo + gcc per platform) |
| **Wails compatibility** | Excellent | Problematic (cgo conflicts) |
| **Performance** | 2-10x slower | Faster |
| **Use case fit** | Perfect for flow storage (low frequency) | Overkill for this workload |
| **Build complexity** | Zero (go build works) | Requires C toolchain |

**For this project:** Flow persistence is low-frequency (save on edit, load on open). The 2-10x performance penalty is negligible. The cgo-free benefit is critical for Wails cross-platform builds.

**Sources:**
- [modernc.org/sqlite Go Packages](https://pkg.go.dev/modernc.org/sqlite)
- [SQLite cgo vs no-cgo comparison](https://datastation.multiprocess.io/blog/2022-05-12-sqlite-in-go-with-and-without-cgo.html)
- [Go SQLite benchmarks](https://github.com/cvilsmeier/go-sqlite-bench)

## Complementary Libraries

### State Management (Frontend)

| Library | Version | Purpose | Rationale | Confidence |
|---------|---------|---------|-----------|------------|
| **Zustand** | 5.x | Client state management | 30%+ YoY growth, 40% of projects in 2026. Minimal boilerplate vs Redux. Perfect for medium-sized apps. Co-located logic (auth, canvas state, flow execution state). Avoid Redux overkill for single-developer project. | **HIGH** |

**Why Zustand over Redux Toolkit:**
- Redux is 10% of new projects in 2026 (down from dominance)
- Redux Toolkit is for large multi-team projects (5+ developers)
- SIPFlow is single/small-team project
- Zustand: less ceremony, easier testing, smaller bundle

**State Architecture:**
```
Server state: NOT NEEDED (no backend API, Wails bindings are RPC-style)
Canvas state: Zustand (nodes, edges, selection, undo/redo)
Flow execution: Zustand (running state, SIP call state)
Auth/Settings: Zustand (user preferences, SIP server configs)
```

**Sources:**
- [Zustand vs Redux 2026](https://medium.com/@sangramkumarp530/zustand-vs-redux-toolkit-which-should-you-use-in-2026-903304495e84)
- [React State Management 2026](https://www.nucamp.co/blog/state-management-in-2026-redux-context-api-and-modern-patterns)

### UI Components (Frontend)

| Library | Version | Purpose | Rationale | Confidence |
|---------|---------|---------|-----------|------------|
| **Tailwind CSS** | 4.x | Utility-first CSS | Tailwind v4 released with @theme directive. shadcn/ui now supports Tailwind v4. Standard for 2026 React projects. Small bundle (only ships used classes). | **HIGH** |
| **shadcn/ui** | Latest | Component library | 104K+ GitHub stars, 560K+ weekly npm downloads (Jan 2026). Copy-paste components (no dependency bloat). Full code ownership (customize freely). Radix UI primitives (accessibility built-in). Updated for React 19 (forwardRef removed). Tailwind v4 support. HSL → OKLCH color space. | **MEDIUM** |

**Why shadcn/ui:**
- NOT a dependency (copies code into your repo)
- Full customization (own the components)
- Accessible by default (Radix UI)
- Tailwind-native (matches chosen CSS approach)
- React 19 compatible (recent update)

**Alternative considered:** Headless UI, Radix UI directly
**Why not:** shadcn/ui provides pre-styled components on top of Radix, faster development

**Sources:**
- [shadcn/ui](https://www.shadcn.io/)
- [Tailwind v4 shadcn support](https://ui.shadcn.com/docs/tailwind-v4)
- [14 Best React UI Libraries 2026](https://www.untitledui.com/blog/react-component-libraries)

### Undo/Redo (Frontend)

| Library | Version | Purpose | Rationale | Confidence |
|---------|---------|---------|-----------|------------|
| **useUndoable** | Latest | Undo/redo hook | Stack-based history for xyflow nodes/edges. Community-proven with React Flow examples. Lightweight alternative to React Flow Pro example. | **MEDIUM** |

**Alternative:** React Flow Pro (official undo/redo example)
**Why useUndoable:** Free, open-source, community-maintained, good enough for this use case

**Sources:**
- [useUndoable GitHub](https://github.com/xplato/useUndoable)
- [React Flow Undo/Redo Discussion](https://github.com/xyflow/xyflow/discussions/3364)

### Testing (Frontend)

| Library | Version | Purpose | Rationale | Confidence |
|---------|---------|---------|-----------|------------|
| **Vitest** | 3.x | Test runner | Built on Vite (same tooling). 10-20x faster than Jest on large codebases. Native ESM support. Jest-compatible API. Vite projects standard in 2026. | **HIGH** |
| **@testing-library/react** | Latest | Component testing | User-focused testing (behavior over implementation). Standard for React testing in 2026. Works seamlessly with Vitest. | **HIGH** |

**Why Vitest over Jest:**
- Vite-native (reuses dev server, faster)
- ESM-first (no transpilation hacks)
- Modern API (async/await friendly)
- 2026 standard for Vite projects

**Sources:**
- [Vitest React Testing Library 2026](https://oneuptime.com/blog/post/2026-01-15-unit-test-react-vitest-testing-library/view)
- [Testing in 2026 Guide](https://www.nucamp.co/blog/testing-in-2026-jest-react-testing-library-and-full-stack-testing-strategies)

### Testing (Backend - Go)

| Library | Version | Purpose | Rationale | Confidence |
|---------|---------|---------|-----------|------------|
| **testify** | v1.x | Assertions and mocking | Most popular Go testing library. 23K+ imports. Clean assertion syntax. Mock package for SIP dependencies. Suite package for setup/teardown. | **HIGH** |
| **go.uber.org/mock** | v0.5.0+ | Interface mocking | Uber's maintained fork of gomock (original unmaintained). Type-safe mock generation. Perfect for mocking diago/sipgo interfaces. | **HIGH** |

**Testing Strategy:**
- testify/assert: Readable assertions
- testify/mock: Manual mocks for simple cases
- uber/mock: Generated mocks for complex interfaces (SIP stack)
- testify/suite: Test suites with common setup

**Sources:**
- [testify GitHub](https://github.com/stretchr/testify)
- [Go Testing Libraries Comparison](https://softwarepatternslexicon.com/go/tools-and-libraries-for-go-design-patterns/testing-libraries/)

### Code Quality (Frontend)

| Library | Version | Purpose | Rationale | Confidence |
|---------|---------|---------|-----------|------------|
| **ESLint** | 9.x | Linting | Flat config format (eslint.config.mjs). TypeScript + React support. Wails projects should use ESLint 9. | **HIGH** |
| **Prettier** | 3.x | Code formatting | Standard formatter. Integrates with ESLint. | **HIGH** |

**ESLint 9 Setup:**
```javascript
// eslint.config.mjs
import js from '@eslint/js'
import reactPlugin from 'eslint-plugin-react'
import reactHooksPlugin from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn'
    }
  }
]
```

**Sources:**
- [ESLint 9 Flat Config Guide](https://dev.to/aolyang/eslint-9-flat-config-tutorial-2bm5)
- [React Hooks ESLint 9 Support](https://github.com/facebook/react/issues/28313)

## Optional Enhancements

### Data Fetching (if HTTP APIs added later)

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| **TanStack Query** | v6.x | Server state management | IF external SIP server APIs added. IF cloud sync features. NOT needed for initial MVP (Wails bindings suffice). | **MEDIUM** |

**Current Assessment:** NOT needed for MVP. Wails bindings are RPC-style (not REST/GraphQL). If future features add HTTP APIs (e.g., SIP server provisioning APIs), TanStack Query becomes relevant.

**Sources:**
- [TanStack Query 2026 Guide](https://dev.to/krish_kakadiya_5f0eaf6342/react-server-components-tanstack-query-the-2026-data-fetching-power-duo-you-cant-ignore-21fj)

## Anti-Recommendations

### What NOT to Use

| Technology | Why Avoid | Alternative |
|------------|-----------|-------------|
| **mattn/go-sqlite3** | Requires cgo (breaks Wails cross-compilation). C compiler dependency. | modernc.org/sqlite |
| **Redux Toolkit** | Overkill for small team. Ceremony overhead. 2026 trend away from Redux for new projects. | Zustand |
| **Jest** | Slower than Vitest on Vite projects. ESM compatibility hacks. Legacy choice in 2026. | Vitest |
| **Electron** | 100MB+ bundle size. Full Chromium embedded. Wails uses native webview (smaller, faster). | Wails (already chosen) |
| **React 18** | React 19 stable since Dec 2024. Missing compiler optimizations. forwardRef boilerplate. | React 19 |
| **Wails v3** | Alpha only. Nightly releases. Not production-ready. | Wails v2.10 |

## Installation Guide

### Backend (Go)

```bash
# Install Wails CLI
go install github.com/wailsapp/wails/v2/cmd/wails@latest

# Core dependencies
go get github.com/emiago/diago@v0.26.0
go get github.com/emiago/sipgo@latest
go get modernc.org/sqlite@latest

# Testing
go get github.com/stretchr/testify@latest
go get go.uber.org/mock@latest
```

### Frontend (Node)

```bash
# Core framework
npm install react@19.2.4 react-dom@19.2.4
npm install @xyflow/react@12.10.0

# State management
npm install zustand

# UI (install shadcn CLI, copy components as needed)
npx shadcn@latest init

# Undo/redo
npm install use-undoable

# Dev dependencies
npm install -D vite@latest
npm install -D typescript@latest
npm install -D @vitejs/plugin-react@latest
npm install -D tailwindcss@latest postcss autoprefixer

# Testing
npm install -D vitest@latest
npm install -D @testing-library/react@latest
npm install -D @testing-library/dom@latest
npm install -D jsdom@latest

# Linting
npm install -D eslint@9
npm install -D @eslint/js
npm install -D typescript-eslint
npm install -D eslint-plugin-react
npm install -D eslint-plugin-react-hooks
npm install -D prettier
```

## Architecture Notes

### Wails Go-React Communication

**Binding Strategy:**
1. **Method Bindings (Primary):** Go structs with public methods auto-generate TypeScript functions
2. **Events (Secondary):** Pub/sub for async notifications (SIP events → UI updates)

**Example:**
```go
// backend/sip.go
type SIPController struct {
    ctx context.Context
}

// Auto-bound to frontend as TypeScript async function
func (s *SIPController) MakeCall(from, to string) error {
    // diago call logic
    runtime.EventsEmit(s.ctx, "call:ringing", to)
    return nil
}
```

```typescript
// frontend/src/services/sip.ts
import { MakeCall } from '../wailsjs/go/backend/SIPController'
import { EventsOn } from '../wailsjs/runtime'

// Type-safe binding
await MakeCall("sip:alice@example.com", "sip:bob@example.com")

// Event listener
EventsOn("call:ringing", (number) => {
  console.log(`Ringing: ${number}`)
})
```

**Best Practices (from Wails docs):**
- Use namespaces for events (e.g., `call:ringing`, not `ringing`)
- Clean up event listeners on component unmount
- Bindings return Promises (always `await`)
- Wails auto-generates TypeScript models for Go structs (end-to-end type safety)

**Sources:**
- [Wails Bindings Guide](https://v3alpha.wails.io/learn/bindings/)
- [Wails Events Reference](https://v3alpha.wails.io/guides/events-reference/)

### xyflow State Management

**Recommended Pattern:**
```typescript
// Use Zustand for nodes/edges state
// Use useUndoable for undo/redo history
// xyflow handles internal selection/dragging state

import { create } from 'zustand'
import { useUndoable } from 'use-undoable'

const useFlowStore = create((set) => ({
  nodes: [],
  edges: [],
  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges })
}))

// In component:
const { nodes, edges } = useFlowStore()
const [
  flowState,
  setFlowState,
  { undo, redo, canUndo, canRedo }
] = useUndoable({ nodes, edges })
```

**Sources:**
- [xyflow Custom Nodes](https://reactflow.dev/examples/nodes/custom-node)
- [xyflow Undo/Redo Discussion](https://github.com/xyflow/xyflow/discussions/3364)

## Version Verification

All versions verified as of **2026-02-01**:

| Component | Current Stable | Source |
|-----------|---------------|---------|
| Wails | v2.10 (Feb 2025) | [Wails Changelog](https://wails.io/changelog/) |
| React | 19.2.4 (Jan 2026) | [React npm](https://www.npmjs.com/package/react) |
| Vite | 6.x (compatible with React 19) | [Vite Releases](https://vite.dev/releases) |
| @xyflow/react | 12.10.0 | [xyflow npm](https://www.npmjs.com/package/@xyflow/react) |
| diago | v0.26.0 (Jan 27, 2026) | [diago GitHub](https://github.com/emiago/diago) |
| modernc.org/sqlite | v1.36.0+ (Jan 20, 2026) | [modernc.org/sqlite](https://pkg.go.dev/modernc.org/sqlite) |

## Open Questions

1. **SIP Media Handling:** Does MVP need RTP/audio playback, or just SIP signaling? (Affects diago media features usage)
2. **External SIP Server Config:** UI for managing SIP server credentials? (Affects settings state design)
3. **Flow Export Format:** JSON schema for flow persistence? (Affects SQLite schema design)
4. **Multi-Instance Limit:** How many concurrent SIP UA instances? (Affects resource management architecture)

## Next Steps for Roadmap

Based on this stack:

1. **Phase 1 (Foundation):** Wails project setup, React + xyflow canvas, SQLite schema
2. **Phase 2 (SIP Integration):** diago UA wrapper, basic call flow (MakeCall → Bye)
3. **Phase 3 (Proxy):** sipgo embedded proxy for routing
4. **Phase 4 (Advanced Features):** Complex flows (hold/transfer), undo/redo, flow persistence

## Confidence Assessment

| Area | Confidence | Reasoning |
|------|------------|-----------|
| Desktop Framework (Wails) | **HIGH** | Latest stable v2.10, mature ecosystem, user-selected |
| Frontend Stack (React/Vite/xyflow) | **HIGH** | All current 2026 versions, proven compatibility |
| SIP Engine (diago/sipgo) | **HIGH** | Latest releases (Jan 2026), active maintenance, user-selected |
| Database (SQLite + modernc) | **HIGH** | Cgo-free requirement validated, performance acceptable |
| State Management (Zustand) | **HIGH** | 2026 best practice for medium apps, mature library |
| UI Components (shadcn/ui) | **MEDIUM** | Very popular, but copy-paste approach needs discipline |
| Testing (Vitest) | **HIGH** | Standard for Vite projects in 2026 |

**Overall:** This stack is production-ready, current, and well-validated for 2026 desktop SIP application development.
