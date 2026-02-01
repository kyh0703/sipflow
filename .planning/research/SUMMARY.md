# Project Research Summary

**Project:** SIPFlow - SIP Call Flow Designer
**Domain:** Desktop SIP testing and visual flow programming
**Researched:** 2026-02-01
**Confidence:** HIGH

## Executive Summary

SIPFlow is a desktop application for visually designing and executing SIP call flow test scenarios. Based on comprehensive research, the recommended approach is a clean architecture desktop app using Wails v2 (Go backend + React frontend), xyflow for visual node-based design, diago for SIP User Agent simulation, and SQLite for flow persistence. This stack is production-ready for 2026 and avoids common pitfalls like Electron bloat and cgo build complexity.

The key differentiator is combining visual node-based design with real SIP execution - most existing tools either require XML/code (SIPp) or only provide passive analysis (ladder diagram tools). The architecture follows a four-layer clean architecture pattern (Domain, Application, Infrastructure, Interfaces) with event-driven communication between backend SIP execution and frontend visualization.

Critical risks center on event system race conditions, goroutine lifecycle management, SQLite concurrent access, and React Flow performance optimization. These must be addressed in the foundation phase before adding complexity. The research validates this is a viable product with clear competitive positioning and well-understood technical patterns.

## Key Findings

### Recommended Stack

The user-selected stack (Go + Wails v2, React + xyflow, diago, SQLite) is well-validated for 2026, providing a cgo-free, cross-platform desktop app with embedded SIP capabilities and visual flow editing.

**Core technologies:**
- **Wails v2.10** (Feb 2025): Desktop framework with native OS webview, automatic Go-React bindings, no cgo requirement - v3 is alpha-only
- **React 19.2.4** + **Vite 6**: Latest stable frontend with compiler optimizations, forwardRef removed for cleaner custom nodes
- **@xyflow/react 12.10.0**: Visual flow editor (renamed from reactflow), SSR support, performance improvements for 100+ node flows
- **diago v0.26.0** (Jan 27, 2026): SIP User Agent library built on sipgo, full dialog control, RTP/DTCP/DTMF support, actively maintained
- **modernc.org/sqlite v1.36.0+**: CGO-FREE SQLite driver (critical for Wails cross-compilation), acceptable 2-10x performance penalty for low-frequency flow storage
- **Zustand 5.x**: Client state management (30%+ YoY growth, minimal boilerplate vs Redux overkill)
- **shadcn/ui**: Copy-paste component library on Radix UI primitives, full code ownership, React 19 compatible
- **Vitest 3.x** + **@testing-library/react**: Vite-native testing (10-20x faster than Jest), standard for 2026

**Why this stack:**
- Wails v2 uses native webview (smaller bundle than Electron), seamless Go-React bindings, mature v2 ecosystem
- modernc.org/sqlite is cgo-free (easy cross-compilation) vs mattn/go-sqlite3 (cgo dependency nightmare)
- diago provides high-level dialog/session management over raw sipgo SIP stack
- React 19 stable since Dec 2024 with compiler optimizations for complex flow graphs
- Zustand appropriate for medium-sized single/small-team projects (Redux is overkill)

### Expected Features

SIP call flow designer and testing tools fall into three categories: visual flow designers (rare), XML-based scenario tools (SIPp dominates), and passive visualization tools. SIPFlow's node-based visual designer for SIP UA testing is a differentiator.

**Must have (table stakes):**
- **Basic Call Operations** (INVITE, BYE, CANCEL) - fundamental to any SIP tool
- **Scenario Save/Load** - users expect to persist work
- **Execute & Visualize Results** - real-time execution with success/failure indication
- **Multiple SIP UA Instances** - 2+ UAs required for transfer/conference testing
- **Message Tracing/Logging** - SIP message log for debugging
- **Basic Call Hold** - re-INVITE with sendonly/recvonly
- **SIP Server Config** - configure proxy/registrar address
- **Transport Protocol Support** - UDP minimum, TCP expected, TLS nice-to-have
- **Project Organization** - save multiple scenarios, folder/tagging
- **Error Handling Visibility** - show SIP error codes (4xx, 5xx), timeout detection

**Should have (competitive differentiators):**
- **Visual Node-Based Designer** - drag-drop nodes (SIPFlow's core differentiator vs SIPp's XML)
- **Real-Time Flow Animation** - highlight active nodes during execution (visual feedback competitors lack)
- **Comprehensive Transfer Support** - blind, attended, semi-attended transfer (most tools only do basic REFER)
- **Event-Driven Flow Control** - event nodes (wait for INVITE, wait for timeout) for complex conditional flows
- **Embedded SIP Server** - built-in SIP server for zero-config local testing
- **Command Coverage Depth** - mute, hold, retrieve, transfers, 486 Busy (beyond basic call/hangup)
- **Flow Execution History** - save execution results, compare runs
- **Template Library** - pre-built flows (basic call, transfer, conference)

**Defer (v2+):**
- Code generation from flows (feature creep)
- Built-in call recording (scope expansion)
- Multi-user collaboration (premature complexity)
- AI-powered flow suggestions (buzzword-driven)
- VoIP quality metrics/MOS/jitter (media analysis vs signaling focus)
- Custom SIP protocol extensions (over-engineering)

**Critical path:** SIP UA Instance → Basic Commands (INVITE/BYE) → Execute Engine → Result Visualization

### Architecture Approach

SIPFlow follows a layered desktop application architecture with clean separation: UI (React/xyflow) → Wails bindings → Application logic (Go services) → Domain models → Infrastructure (diago + SQLite).

**Major components:**
1. **Frontend Layer (React + xyflow)** - Visual flow editing, user interaction, real-time execution visualization; uses xyflow's useNodesState/useEdgesState hooks, Zustand for cross-component state, Wails event listeners for backend-pushed updates
2. **Wails Bindings Layer (Go Structs)** - Expose application functionality to frontend via auto-generated TypeScript bindings; FlowService (CRUD), SimulationService (execution), ProjectService (config), UAService (UA management)
3. **Application Layer (Go Services)** - Orchestrate business workflows; FlowManager (CRUD orchestration), ExecutionEngine (topological sort → execution plan → command dispatch), UAManager (diago UA lifecycle), ConfigManager (settings)
4. **Domain Layer (Go Core)** - Pure business logic, no external dependencies; Flow model (graph), Node types (SIP/Command/Event), UAConfig (SIP URI), ExecutionPlan (topologically sorted steps)
5. **Infrastructure Layer (Go)** - External systems; SQLiteRepository (flow/UA persistence), DiagoSIPEngine (SIP signaling), EmbeddedSIPServer (sipgo proxy)

**Key patterns:**
- **Topological sort for execution plan** (Kahn's algorithm) - guarantees execution order respects dependencies
- **Event-driven frontend updates** - Wails EventsEmit from Go → EventsOn listener in React → update xyflow node state
- **Repository pattern** for data access - abstract SQLite behind interface for testability
- **Context-based cancellation** - propagate context.Context through execution chain for graceful shutdown
- **Clean Architecture layer separation** - enforce dependency direction (outer → inner), domain has no external dependencies

**Data flow (execution):**
1. User clicks "Start Simulation" → SimulationService.StartSimulation(flowID)
2. ExecutionEngine.Execute(flow) → load from SQLite → topological sort → create diago UAs
3. For each step: DiagoSIPEngine.ExecuteCommand() → EventsEmit("simulation:progress") → React listener → xyflow node style update
4. User sees animated execution on canvas in real-time

### Critical Pitfalls

Research identified 12 pitfalls (5 critical, 4 moderate, 3 minor). Top 5 critical pitfalls:

1. **Wails Event System Race Conditions** - Frontend EventsOn listeners race with backend EventsEmit, causing missing events or data inconsistency. PREVENTION: Implement handshake protocol (frontend signals "ready" before backend emits), add 100μs delay after EventsEmit (documented workaround), queue backend events until frontend confirms listener registration. DETECTION: "TRA | No listeners for event" warnings.

2. **Goroutine Leaks in SIP Session Management** - Each SIP session spawns goroutines; without cleanup, long-running apps leak thousands of goroutines until crash. diago Invite() is NOT THREAD SAFE. PREVENTION: Use context.Context for ALL goroutine lifecycles, store cancel functions in session registry, use uber-go/goleak in tests, monitor runtime.NumGoroutine(). DETECTION: Memory grows even when sessions terminate.

3. **SQLite Concurrent Access Database Locked Errors** - Multiple goroutines attempt simultaneous writes, causing "database is locked" errors. mattn/go-sqlite3 explicitly does NOT support concurrent access. PREVENTION: Use single-writer pattern (dedicated goroutine owns all writes), implement write queue with channel, enable WAL mode, set busy timeout. DETECTION: "database is locked" errors.

4. **React Flow Performance Collapse with Large Graphs** - Flow designer unusable with 100+ nodes due to nodeTypes defined inside component (forces full re-render). PREVENTION: Define nodeTypes OUTSIDE component or useMemo, memoize custom nodes with React.memo, use shallow selectors, debounce position updates. DETECTION: Profiler shows 100ms+ render times.

5. **SIP Timer Mismanagement Causing Transaction Failures** - SIP transactions fail due to incorrect timer handling (retransmissions stop too early, timeouts premature). RFC 3261 defines complex timer hierarchy (T1, T2, Timer A-K). PREVENTION: Use diago's built-in timer management, understand timer relationships (Timer A exponential backoff, Timer B 64*T1=32s timeout), make T1 configurable per network. DETECTION: Transaction timeouts after exactly 32 seconds.

**Additional moderate pitfalls:**
- Undo/redo state explosion (save on every interaction)
- Wails build vs dev environment divergence (OnShutdown not called in dev)
- SIP one-way audio (NAT/firewall blocks RTP path, need STUN/TURN)
- Flow execution order non-determinism (parallel branches race)

## Implications for Roadmap

Based on combined research, the roadmap should follow a dependency-driven phase structure that establishes foundational patterns before adding complexity. The architecture requires careful sequencing to avoid critical pitfalls.

### Phase 1: Foundation & Visual Designer
**Rationale:** Establish event system patterns, SQLite access patterns, and React Flow performance patterns BEFORE SIP integration. Critical pitfalls (event races, SQLite locking, React Flow performance) must be addressed in foundation.

**Delivers:**
- Wails project skeleton with event handshake protocol
- xyflow canvas with custom node types (SIP Instance, Command, Event)
- SQLite schema with migration system and single-writer pattern
- Flow CRUD operations (create, save, load, delete)
- Basic project organization (flow list, selection)

**Addresses (from FEATURES.md):**
- Visual Node-Based Designer (core differentiator)
- Scenario Save/Load (table stakes)
- Project Organization (table stakes)

**Avoids (from PITFALLS.md):**
- Pitfall 1: Event system race conditions (implement handshake early)
- Pitfall 3: SQLite concurrent access (single-writer pattern from start)
- Pitfall 4: React Flow performance (nodeTypes memoization from start)
- Pitfall 12: Schema migration without versioning (migration system before first release)

**Stack elements used:**
- Wails v2.10, React 19, Vite 6, @xyflow/react 12.10.0, modernc.org/sqlite, Zustand

**Research flag:** SKIP - visual flow editors and Wails patterns are well-documented

---

### Phase 2: Basic SIP Integration
**Rationale:** Add minimal SIP functionality (MakeCall, BYE) with proper goroutine lifecycle management. Validates diago integration before complex scenarios.

**Delivers:**
- diago SIP engine wrapper with context-based lifecycle
- SIP UA Instance node implementation (create/configure UA)
- Basic Command nodes (MakeCall/INVITE, BYE)
- SIP message logging window
- External SIP server configuration UI
- Goroutine leak detection tests

**Addresses (from FEATURES.md):**
- Basic Call Operations (INVITE, BYE) - table stakes
- SIP Server Config - table stakes
- Message Tracing/Logging - table stakes
- Transport Protocol Support (UDP minimum) - table stakes

**Avoids (from PITFALLS.md):**
- Pitfall 2: Goroutine leaks (context-based lifecycle, goleak tests)
- Pitfall 5: SIP timer mismanagement (use diago built-in timers)
- Pitfall 10: Custom struct serialization (exported fields, JSON tags)

**Stack elements used:**
- diago v0.26.0, sipgo (underlying)

**Research flag:** NEEDS RESEARCH - diago has limited production usage documentation, may need API exploration for edge cases

---

### Phase 3: Flow Execution Engine
**Rationale:** Implement execution plan generation (topological sort) and event-driven visualization. Builds on Phase 1 event patterns and Phase 2 SIP commands.

**Delivers:**
- Execution engine with topological sort (Kahn's algorithm)
- Event nodes (wait for INVITE, wait for timeout)
- Real-time flow animation (highlight executing nodes)
- Execution result visualization (success/failure)
- Deterministic execution with dependency graph

**Addresses (from FEATURES.md):**
- Execute & Visualize Results - table stakes
- Real-Time Flow Animation - differentiator
- Event-Driven Flow Control - differentiator
- Error Handling Visibility - table stakes

**Avoids (from PITFALLS.md):**
- Pitfall 9: Flow execution order non-determinism (explicit dependency graph, channels for coordination)
- Pitfall 6: Undo/redo state explosion (filter change events, execution results don't create undo steps)

**Architecture component:**
- ExecutionEngine (Application layer)
- ExecutionPlan (Domain layer)

**Research flag:** SKIP - topological sort and workflow engine patterns are well-documented

---

### Phase 4: Advanced SIP Features
**Rationale:** Add comprehensive SIP command coverage for realistic testing scenarios. Depends on execution engine from Phase 3.

**Delivers:**
- Call Hold command (re-INVITE with sendonly/recvonly)
- CANCEL command (cancel outgoing call)
- Blind Transfer command (REFER)
- Attended Transfer command (REFER with Replaces)
- 486 Busy response
- Multiple SIP UA instances support
- DTMF support

**Addresses (from FEATURES.md):**
- Basic Call Hold - table stakes
- Multiple SIP UA Instances - table stakes
- Comprehensive Transfer Support - differentiator
- Command Coverage Depth - differentiator

**Avoids (from PITFALLS.md):**
- Pitfall 8: SIP one-way audio (implement STUN for NAT traversal, RTP diagnostics)

**Research flag:** NEEDS RESEARCH - Blind/Attended Transfer has complex RFC specs, may need protocol research for correct implementation

---

### Phase 5: Embedded SIP Server (Optional)
**Rationale:** Add built-in SIP proxy for zero-config local testing. Uses sipgo directly (not diago).

**Delivers:**
- Embedded SIP proxy using sipgo example/proxysip
- Proxy routes between UA instances
- Local testing mode (no external server required)
- Proxy configuration UI

**Addresses (from FEATURES.md):**
- Embedded SIP Server - differentiator
- Zero-config testing experience

**Stack elements used:**
- sipgo (proxy example)

**Research flag:** NEEDS RESEARCH - sipgo proxy implementation patterns need exploration, limited documentation

---

### Phase 6: Polish & Production Readiness
**Rationale:** Add quality-of-life features and production monitoring.

**Delivers:**
- Flow execution history (save past runs)
- Template library (pre-built scenarios)
- Production build testing in CI
- Goroutine/memory monitoring
- SQLite write queue monitoring
- Performance profiling (React Flow, goroutines)

**Addresses (from FEATURES.md):**
- Flow Execution History - differentiator
- Template Library - nice-to-have

**Avoids (from PITFALLS.md):**
- Pitfall 7: Build vs dev divergence (regular production build testing)
- Pitfall 11: React Flow edge routing performance (if needed)

**Research flag:** SKIP - monitoring and profiling patterns are standard

---

### Phase Ordering Rationale

**Dependency-driven sequence:**
1. Phase 1 establishes foundational patterns (event system, SQLite access, React Flow performance) that ALL subsequent phases depend on
2. Phase 2 adds minimal SIP functionality to validate diago integration before complex scenarios
3. Phase 3 builds execution engine on top of Phase 1 event patterns and Phase 2 SIP commands
4. Phase 4 expands SIP coverage once execution engine is proven
5. Phase 5 (optional) adds convenience feature that doesn't affect core functionality
6. Phase 6 adds production readiness after core features complete

**Pitfall-driven grouping:**
- Phase 1 addresses all foundation-level pitfalls (event races, SQLite, React Flow) before they compound
- Phase 2 addresses SIP-specific pitfalls (goroutine leaks, timers) in isolation
- Phase 3 addresses execution pitfalls (non-determinism) once SIP basics work
- Phase 6 addresses production pitfalls (build divergence, monitoring) at end

**Architecture-driven grouping:**
- Phase 1: UI Layer + Wails Bindings + Infrastructure (SQLite)
- Phase 2: Infrastructure (diago SIP engine)
- Phase 3: Application Layer (ExecutionEngine) + Domain Layer (ExecutionPlan)
- Phase 4: Infrastructure expansion (more diago commands)
- Phase 5: Infrastructure (sipgo proxy)

**Feature-driven grouping:**
- Phase 1: Table stakes (save/load, visual designer)
- Phase 2: Table stakes (basic SIP operations)
- Phase 3: Table stakes (execution) + differentiators (animation, events)
- Phase 4: Table stakes (hold, multiple UAs) + differentiators (transfers)
- Phase 5: Differentiator (embedded server)
- Phase 6: Nice-to-have (templates, history)

### Research Flags

**Phases needing deeper research during planning:**
- **Phase 2 (SIP Integration):** diago API exploration for edge cases, limited production usage documentation
- **Phase 4 (Advanced SIP):** Blind/Attended Transfer RFC specs (5589, 3515), REFER/Replaces header construction
- **Phase 5 (Embedded Server):** sipgo proxy implementation patterns, stateful proxy routing

**Phases with standard patterns (skip research-phase):**
- **Phase 1 (Foundation):** Visual flow editors well-documented, Wails patterns established, React Flow performance guide comprehensive
- **Phase 3 (Execution Engine):** Topological sort and workflow engine patterns well-understood, DAG validation standard
- **Phase 6 (Polish):** Monitoring, profiling, testing patterns are standard software engineering

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | All versions verified current for 2026, user-selected stack validated by research, cgo-free requirement addressed, proven compatibility |
| Features | **MEDIUM** | Comprehensive WebSearch with cross-verification, limited Context7 for domain-specific tools, no real user feedback from SIP QA engineers |
| Architecture | **MEDIUM** | Wails v2 and React Flow patterns well-documented, clean architecture principles established, flow execution engine patterns inferred from general programming |
| Pitfalls | **HIGH** | Wails issues from GitHub with reproducible cases, React Flow performance from official docs, SQLite concurrency from library docs, goroutine leaks from case studies |

**Overall confidence:** **HIGH**

The stack is production-ready and current for 2026. Critical pitfalls are well-documented with clear prevention strategies. Feature research is solid but would benefit from user validation. Architecture follows proven patterns but flow execution engine is somewhat novel (SIP-specific visual programming).

### Gaps to Address

**During planning/implementation:**

1. **diago library edge cases** - Limited production usage documentation compared to mainstream SIP libraries. Plan to experiment with API during Phase 2, potentially need to read source code for undocumented behavior. Mitigation: Allocate extra time for Phase 2 research-phase exploration.

2. **SIP Transfer RFC implementation** - Blind/Attended Transfer involves complex REFER/Replaces header construction per RFC 5589/3515. Plan to do protocol research during Phase 4 planning. Mitigation: Use /gsd:research-phase specifically for transfer implementation patterns.

3. **sipgo proxy patterns** - Embedded SIP server implementation has limited documentation beyond example code. Plan to read sipgo example/proxysip source during Phase 5. Mitigation: Mark Phase 5 as optional, can defer if too complex.

4. **Real user validation** - Feature categorization (table stakes vs differentiators) is analyst-driven without SIP QA engineer feedback. Mitigation: Build MVP (Phases 1-3) and get user feedback before committing to all Phase 4 features.

5. **React Flow canvas renderer** - Edge performance pitfall mentions experimental canvas renderer as solution, but stability unknown. Mitigation: Defer to Phase 6 if performance issues actually appear, prefer simpler edge types first.

6. **STUN/TURN integration with diago** - One-way audio pitfall requires STUN/TURN, but diago integration patterns not documented. Mitigation: Research during Phase 4 when RTP path validation becomes priority.

**Validation needed during development:**
- Goroutine leak detection tests (Phase 2) will validate context-based lifecycle pattern
- React Flow performance profiling (Phase 1) will validate if 100+ nodes actually performs well
- Production build testing (ongoing) will validate no dev/build divergence
- Network delay simulation (Phase 2/4) will validate SIP timer behavior under real conditions

## Sources

### Primary (HIGH confidence)

**Stack research:**
- [Wails Changelog](https://wails.io/changelog/) - v2.10 latest stable, v3 alpha-only
- [React v19 Blog](https://react.dev/blog/2024/12/05/react-19) - stable Dec 2024, forwardRef removed
- [xyflow npm package](https://www.npmjs.com/package/@xyflow/react) - v12.10.0 latest
- [diago GitHub](https://github.com/emiago/diago) - v0.26.0 Jan 27, 2026
- [modernc.org/sqlite Go Packages](https://pkg.go.dev/modernc.org/sqlite) - cgo-free driver
- [Zustand vs Redux 2026](https://medium.com/@sangramkumarp530/zustand-vs-redux-toolkit-which-should-you-use-in-2026-903304495e84)

**Architecture research:**
- [Wails Application Development](https://wails.io/docs/guides/application-development/)
- [React Flow Custom Nodes](https://reactflow.dev/learn/customization/custom-nodes)
- [Clean Architecture in Go](https://threedots.tech/post/introducing-clean-architecture/)
- [Topological Sorting Guide](https://medium.com/@amit.anjani89/topological-sorting-explained-a-step-by-step-guide-for-dependency-resolution-1a6af382b065)

**Pitfalls research:**
- [Wails EventsOn inconsistent data issue #2759](https://github.com/wailsapp/wails/issues/2759)
- [Data race in runtime.Events #2448](https://github.com/wailsapp/wails/issues/2448)
- [Go Concurrency: Preventing Goroutine Leaks](https://dev.to/serifcolakel/go-concurrency-mastery-preventing-goroutine-leaks-with-context-timeout-cancellation-best-1lg0)
- [React Flow Performance Documentation](https://reactflow.dev/learn/advanced-use/performance)
- [SIP Timer and Retransmission Guide](https://thanhloi2603.wordpress.com/2018/10/20/sip-timer-retransmission/)

### Secondary (MEDIUM confidence)

**Features research:**
- [SIPp Main Features](https://sipp.readthedocs.io/en/v3.6.1/sipp.html) - XML scenarios
- [SIPSorcery Call Hold and Transfer](https://sipsorcery-org.github.io/sipsorcery/articles/callholdtransfer.html)
- [RFC 5589 - SIP Call Transfer](https://datatracker.ietf.org/doc/rfc5589/)
- [Node-RED SIP UA](https://github.com/sbarwe/node-red-contrib-sipua) - flow-based SIP

**Pitfalls research:**
- [mattn/go-sqlite3 concurrency problems #1179](https://github.com/mattn/go-sqlite3/issues/1179)
- [Making SQLite faster in Go](https://turriate.com/articles/making-sqlite-faster-in-go)
- [Troubleshooting one-way audio](https://blog.opensips.org/2023/07/06/troubleshooting-one-way-audio-calls/)

### Tertiary (LOW confidence)

**Features research:**
- [GL Communications SIP Protocol Test Suite](https://www.gl.com/session-initiation-protocol-sip-test-suite.html)
- [SIPFlow legacy on SourceForge](https://sourceforge.net/projects/sipflow/)
- [SIP Diagrams Generator](https://sip-diagrams.netlify.app/)

---
*Research completed: 2026-02-01*
*Ready for roadmap: yes*
