# Roadmap: SIPFlow

## Overview

SIPFlow is a desktop call flow designer for SIP developers and QA engineers. This roadmap delivers a complete visual SIP testing tool in 10 phases, starting from project foundation through basic call flows, execution engine, advanced SIP features, and finally embedded server support. The journey ends when users can design SIP scenarios visually and execute them as real SIP signaling.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation & Project Structure** - Wails project skeleton, SQLite schema, Go-React bindings
- [ ] **Phase 2: Visual Flow Designer** - xyflow canvas with SIP/Command/Event nodes
- [ ] **Phase 3: Flow Persistence** - Save and load flows from SQLite
- [ ] **Phase 4: SIP Infrastructure** - External server config, UA lifecycle management
- [ ] **Phase 5: Basic SIP Commands** - MakeCall, Bye, Cancel implementation
- [ ] **Phase 6: Execution Engine** - Topological sort, real-time visualization, event-driven execution
- [ ] **Phase 7: Advanced Call Control** - Hold and Retrieve commands
- [ ] **Phase 8: Call Transfer** - Blind and Mute Transfer support
- [ ] **Phase 9: Advanced SIP Features** - 486 Busy response
- [ ] **Phase 10: Embedded SIP Server** - Built-in SIP proxy for local testing

## Phase Details

### Phase 1: Foundation & Project Structure
**Goal**: Establish Wails desktop application foundation with Go backend, React frontend, SQLite database, and event system patterns that prevent race conditions and ensure cross-platform builds.
**Depends on**: Nothing (first phase)
**Requirements**: FOUN-01, FOUN-02, FOUN-03
**Success Criteria** (what must be TRUE):
  1. User can launch desktop application built with Wails v2
  2. SQLite database initializes on first launch with schema for nodes, edges, and flows
  3. React frontend can call Go backend methods via Wails bindings
  4. Backend can emit events that React receives without race conditions
  5. Application builds cross-platform without cgo dependencies
**Plans**: 4 plans

Plans:
- [ ] 01-01-PLAN.md — Wails project init, Go Clean Architecture structure, SQLite driver, ent schemas
- [ ] 01-02-PLAN.md — React frontend structure, Zustand stores, event hooks, shadcn/ui setup
- [ ] 01-03-PLAN.md — Wails handler bindings, FlowService CRUD, EventEmitter handshake protocol
- [ ] 01-04-PLAN.md — Integration wiring, frontend-backend communication verification, build check

### Phase 2: Visual Flow Designer
**Goal**: Users can visually design SIP call flows using drag-and-drop node-based interface with three node types (SIP Instance, Command, Event) connected by edges.
**Depends on**: Phase 1
**Requirements**: FLOW-01, FLOW-02, FLOW-03, FLOW-04
**Success Criteria** (what must be TRUE):
  1. User can drag SIP Instance nodes onto canvas and configure UA properties (SIP URI, port)
  2. User can add Command nodes (MakeCall, Hold, Retrieve, Blind Transfer, Mute Transfer, Bye, Cancel, 486 Busy) to canvas
  3. User can add Event nodes (SIP event wait) to canvas
  4. User can connect nodes with edges to define execution order
  5. Canvas remains responsive with 100+ nodes without performance degradation
**Plans**: TBD

Plans: (to be created during planning)

### Phase 3: Flow Persistence
**Goal**: Users can save designed flows to SQLite and reload them across sessions, enabling scenario reuse and iteration.
**Depends on**: Phase 2
**Requirements**: FLOW-05
**Success Criteria** (what must be TRUE):
  1. User can save current flow to SQLite (nodes, edges, configurations preserved)
  2. User can load previously saved flow and see exact canvas state restored
  3. User can list all saved flows with metadata (name, created date, last modified)
  4. User can delete flows from storage
  5. SQLite write operations complete without "database is locked" errors under normal usage
**Plans**: TBD

Plans: (to be created during planning)

### Phase 4: SIP Infrastructure
**Goal**: Application can connect to external SIP servers and manage SIP User Agent lifecycle through diago library, establishing foundation for SIP signaling.
**Depends on**: Phase 3
**Requirements**: INFR-01, INFR-03
**Success Criteria** (what must be TRUE):
  1. User can configure external SIP server connection (proxy/registrar address, transport protocol)
  2. Application creates diago UA instance for each SIP Instance node with configured parameters
  3. UA instances start cleanly without goroutine leaks (verified by automated tests)
  4. User can see SIP message trace logs (send/receive) in dedicated panel
  5. UA instances terminate gracefully when flow execution completes
**Plans**: TBD

Plans: (to be created during planning)

### Phase 5: Basic SIP Commands
**Goal**: Users can execute basic SIP call operations (make call, hang up, cancel) through flow execution, validating SIP integration works end-to-end.
**Depends on**: Phase 4
**Requirements**: SIPC-01, SIPC-02, SIPC-03
**Success Criteria** (what must be TRUE):
  1. User can execute MakeCall command node and see SIP INVITE sent via diago
  2. User can execute Bye command node to terminate established call
  3. User can execute Cancel command node to abort outgoing call before answer
  4. SIP message trace shows correct RFC 3261 compliant messages
  5. Commands handle SIP server responses correctly (200 OK, 180 Ringing, 4xx/5xx errors)
**Plans**: TBD

Plans: (to be created during planning)

### Phase 6: Execution Engine
**Goal**: Designed flows execute as real SIP signaling with deterministic order, real-time visual feedback, and observable results - delivering the core value proposition.
**Depends on**: Phase 5
**Requirements**: EXEC-01, EXEC-02, EXEC-03, EXEC-04
**Success Criteria** (what must be TRUE):
  1. User clicks "Start Simulation" and flow executes nodes in dependency-respecting order
  2. Canvas animates execution progress by highlighting currently executing node
  3. User can see execution results (success/failure) displayed on each node after completion
  4. Event nodes pause execution until SIP event occurs or timeout
  5. Execution handles errors gracefully and shows failure reason to user
**Plans**: TBD

Plans: (to be created during planning)

### Phase 7: Advanced Call Control
**Goal**: Users can test call hold/retrieve scenarios essential for PBX and call center testing workflows.
**Depends on**: Phase 6
**Requirements**: SIPC-04, SIPC-05
**Success Criteria** (what must be TRUE):
  1. User can execute Hold command and verify re-INVITE with sendonly SDP sent
  2. User can execute Retrieve command and verify re-INVITE with sendrecv SDP sent
  3. Hold/Retrieve sequence completes without breaking established dialog
  4. SIP trace shows correct SDP media direction changes
**Plans**: TBD

Plans: (to be created during planning)

### Phase 8: Call Transfer
**Goal**: Users can test blind and mute transfer scenarios, critical for contact center and PBX validation.
**Depends on**: Phase 7
**Requirements**: SIPC-06, SIPC-07
**Success Criteria** (what must be TRUE):
  1. User can execute Blind Transfer and verify REFER message sent with correct Refer-To header
  2. User can execute Mute Transfer and verify correct SIP sequence
  3. Transfer commands construct RFC-compliant REFER messages
  4. Post-transfer call state updates correctly on canvas
**Plans**: TBD

Plans: (to be created during planning)

### Phase 9: Advanced SIP Features
**Goal**: Users can test rejection scenarios with 486 Busy response, completing basic SIP response coverage.
**Depends on**: Phase 8
**Requirements**: SIPC-08
**Success Criteria** (what must be TRUE):
  1. User can configure node to respond with 486 Busy to incoming INVITE
  2. SIP trace shows 486 response with correct headers
  3. Caller receives busy indication through diago callback
**Plans**: TBD

Plans: (to be created during planning)

### Phase 10: Embedded SIP Server
**Goal**: Users can run complete SIP scenarios locally without external infrastructure, enabling zero-config testing and demos.
**Depends on**: Phase 9
**Requirements**: INFR-02
**Success Criteria** (what must be TRUE):
  1. User can enable embedded SIP server mode from settings
  2. Embedded server routes SIP messages between UA instances created from SIP Instance nodes
  3. User can run complete call flows (MakeCall, Transfer, Hold) using only embedded server
  4. Embedded server starts/stops cleanly with application lifecycle
  5. User can switch between embedded and external server modes
**Plans**: TBD

Plans: (to be created during planning)

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5 -> 6 -> 7 -> 8 -> 9 -> 10

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Project Structure | 0/4 | Planning complete | - |
| 2. Visual Flow Designer | 0/TBD | Not started | - |
| 3. Flow Persistence | 0/TBD | Not started | - |
| 4. SIP Infrastructure | 0/TBD | Not started | - |
| 5. Basic SIP Commands | 0/TBD | Not started | - |
| 6. Execution Engine | 0/TBD | Not started | - |
| 7. Advanced Call Control | 0/TBD | Not started | - |
| 8. Call Transfer | 0/TBD | Not started | - |
| 9. Advanced SIP Features | 0/TBD | Not started | - |
| 10. Embedded SIP Server | 0/TBD | Not started | - |

---
*Roadmap created: 2026-02-01*
*Last updated: 2026-02-01*
