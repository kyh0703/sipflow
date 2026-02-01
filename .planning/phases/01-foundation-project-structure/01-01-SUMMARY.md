---
phase: 01-foundation-project-structure
plan: 01
subsystem: infra
tags: [wails, ent, sqlite, clean-architecture, go, react-ts]

# Dependency graph
requires:
  - phase: 00-research
    provides: Technology stack decisions
provides:
  - Wails v2 desktop app with React-TS frontend
  - Clean Architecture Go backend structure
  - ent ORM with SQLite database
  - Custom SQLite driver with FK enforcement and WAL mode
  - Domain entities and repository interfaces
affects: [02-ui-setup, 03-flow-management, all future phases]

# Tech tracking
tech-stack:
  added:
    - wails v2.11.0
    - ent v0.14.5
    - modernc.org/sqlite v1.44.3
    - React + TypeScript + Vite
  patterns:
    - Clean Architecture with domain/usecase/infra layers
    - Repository pattern for data access
    - Custom SQLite driver with PRAGMA configuration

key-files:
  created:
    - main.go
    - app.go
    - wails.json
    - go.mod
    - internal/domain/flow.go
    - internal/domain/node.go
    - internal/domain/edge.go
    - internal/domain/repository/flow.go
    - internal/domain/repository/node.go
    - internal/domain/repository/edge.go
    - internal/infra/sqlite/driver.go
    - ent/schema/flow.go
    - ent/schema/node.go
    - ent/schema/edge.go
  modified: []

key-decisions:
  - "Use modernc.org/sqlite (pure Go, no cgo) instead of mattn/go-sqlite3 for cross-platform builds"
  - "Configure SQLite with PRAGMA foreign_keys=ON and journal_mode=WAL in custom driver"
  - "Set MaxOpenConns=1 for SQLite single-writer constraint"
  - "Store database in user config directory (os.UserConfigDir)"
  - "Use ent auto-increment integer IDs instead of UUIDs for simplicity"

patterns-established:
  - "Domain entities have zero external dependencies (only stdlib)"
  - "Repository interfaces live in domain layer, implementations in infra layer"
  - "Database initialization happens in app.startup() lifecycle hook"
  - "Database cleanup happens in app.shutdown() lifecycle hook"

# Metrics
duration: 4min
completed: 2026-02-01
---

# Phase 01 Plan 01: Foundation & Project Structure Summary

**Wails v2 desktop app with Clean Architecture, ent ORM, and custom SQLite driver with FK enforcement and WAL mode**

## Performance

- **Duration:** 4 min
- **Started:** 2026-02-01T09:18:06Z
- **Completed:** 2026-02-01T09:22:20Z
- **Tasks:** 2
- **Files modified:** 77

## Accomplishments
- Wails v2 project initialized with React-TS frontend template
- Clean Architecture directory structure established with proper layer separation
- Domain entities (Flow, Node, Edge) defined with zero external dependencies
- Repository interfaces defined in domain layer
- Custom SQLite driver with foreign key enforcement and WAL mode
- Ent schemas defined with proper relationships and JSON data field
- Database auto-migration on app startup
- Verified cgo-free build (CGO_ENABLED=0 compiles successfully)

## Task Commits

Each task was committed atomically:

1. **Task 1: Initialize Wails project and Go backend directory structure** - `32dd7c5` (feat)
2. **Task 2: Custom SQLite driver, ent schemas, and code generation** - `99056c7` (feat)

## Files Created/Modified

### Core Application
- `main.go` - Wails app entry point with lifecycle hooks
- `app.go` - App struct with ent client initialization and database lifecycle management
- `wails.json` - Wails project configuration

### Domain Layer (Clean Architecture)
- `internal/domain/flow.go` - Flow domain entity
- `internal/domain/node.go` - Node domain entity with JSON data field
- `internal/domain/edge.go` - Edge domain entity
- `internal/domain/repository/flow.go` - FlowRepository interface
- `internal/domain/repository/node.go` - NodeRepository interface
- `internal/domain/repository/edge.go` - EdgeRepository interface

### Infrastructure Layer
- `internal/infra/sqlite/driver.go` - Custom SQLite driver with FK + WAL pragmas
- `ent/schema/flow.go` - Ent Flow schema with timestamps
- `ent/schema/node.go` - Ent Node schema with JSON data field and position
- `ent/schema/edge.go` - Ent Edge schema with source/target FK relationships
- `ent/generate.go` - Code generation directive
- `ent/*.go` - Generated ent client code (37 files)

### Frontend Template
- `frontend/` - React + TypeScript + Vite template from Wails
- `build/` - Platform-specific build assets

## Decisions Made

1. **Use modernc.org/sqlite instead of mattn/go-sqlite3**
   - Rationale: Pure Go implementation, no cgo required, enables true cross-platform builds

2. **Custom SQLite driver with PRAGMA configuration**
   - Rationale: Research revealed missing FK enforcement and WAL mode are common pitfalls
   - Implementation: Driver sets `PRAGMA foreign_keys=ON` and `PRAGMA journal_mode=WAL` on every connection

3. **Single-writer connection pool for SQLite**
   - Rationale: SQLite limitation - multiple writers cause "database is locked" errors
   - Implementation: `MaxOpenConns(1)`, `MaxIdleConns(1)`, `ConnMaxLifetime(0)`

4. **Store database in user config directory**
   - Rationale: Standard location for application data, cross-platform via `os.UserConfigDir()`
   - Implementation: `{UserConfigDir}/sipflow/sipflow.db`

5. **Use ent auto-increment integer IDs**
   - Rationale: Simpler than UUIDs for desktop app, sufficient for single-user use case

6. **Zero external dependencies in domain layer**
   - Rationale: Clean Architecture requirement - domain should have no framework dependencies
   - Verification: `go list -f '{{.Imports}}' ./internal/domain/...` shows only stdlib (time, context)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all tasks completed successfully on first attempt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

**Ready for Phase 2 (UI Setup)**
- Wails project compiles and runs
- Database schema created and verified
- Clean Architecture structure in place
- Repository interfaces defined for future implementation

**No blockers or concerns**
- All verification criteria passed
- Cgo-free build confirmed
- Foreign key constraints active
- Domain layer properly isolated

---
*Phase: 01-foundation-project-structure*
*Completed: 2026-02-01*
