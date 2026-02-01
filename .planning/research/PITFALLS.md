# Domain Pitfalls: SIP Call Flow Designer

**Domain:** Desktop SIP call flow designer with visual programming
**Stack:** Go + Wails v2, React + Vite + xyflow, diago (SIP), SQLite
**Researched:** 2026-02-01
**Overall Confidence:** MEDIUM (WebSearch-verified with official sources)

## Critical Pitfalls

Mistakes that cause rewrites, data loss, or major architectural problems.

---

### Pitfall 1: Wails Event System Race Conditions

**What goes wrong:**
Frontend EventsOn listeners race with backend EventsEmit, causing data inconsistency, missing events, or events firing before listeners are ready. A documented data race exists when frontend adds EventsOn while backend calls EventsEmit simultaneously.

**Why it happens:**
- Wails event system has async behavior with unpredictable timing
- Frontend routing can load listeners after backend starts emitting
- No built-in synchronization mechanism for event readiness
- Page refresh during development destroys event bindings

**Consequences:**
- SIP events arrive at frontend out-of-order or missing entirely
- Flow animation desyncs from actual SIP state
- Impossible to debug timing-dependent SIP scenarios
- Users see stale or inconsistent call state

**Prevention:**
1. Implement handshake protocol: Frontend signals "ready" before backend emits
2. Add 100μs delay after EventsEmit (documented workaround for race)
3. Queue backend events until frontend confirms listener registration
4. Use EventsOnce for critical initialization events
5. Avoid emitting events in OnStartup - wait for explicit frontend ready signal

**Detection:**
- "TRA | No listeners for event" warnings in terminal
- Events work intermittently or only after delay
- Frontend receives empty/partial data from events
- Different behavior between `wails dev` and `wails build`

**Phase Impact:**
- Phase 1 (Foundation): Establish event protocol BEFORE building SIP integration
- Phase 2 (SIP Integration): Critical for real-time event delivery
- Phase 3 (Flow Execution): Required for animation sync

**Sources:**
- [Wails EventsOn inconsistent data issue](https://github.com/wailsapp/wails/issues/2759)
- [Data race in runtime.Events system](https://github.com/wailsapp/wails/issues/2448)
- [EventsEmit listening conditions](https://github.com/wailsapp/wails/issues/3067)

**Confidence:** HIGH (GitHub issues with reproducible cases)

---

### Pitfall 2: Goroutine Leaks in SIP Session Management

**What goes wrong:**
Each SIP session spawns goroutines for transaction handling, RTP processing, and timer management. Without proper cleanup, long-running applications leak thousands of goroutines, consuming memory until crash.

**Why it happens:**
- diago library Invite() is NOT THREAD SAFE - concurrent calls create race conditions
- SIP sessions create multiple goroutines: transaction layer, dialog layer, RTP handling
- Blocked channels prevent goroutine exit (waiting on never-sent data)
- Context cancellation not propagated to all session components
- OnShutdown callback not called in `wails dev` mode during hot reload

**Consequences:**
- Memory grows unbounded (documented case: 50,846 goroutines for 1,000 connections)
- Application becomes unresponsive over time
- Hot reload during development leaves orphaned sessions
- SIP sessions can't be cancelled/terminated cleanly

**Prevention:**
1. Use context.Context for ALL goroutine lifecycles
2. Create session-specific context from app context: `sessionCtx, cancel := context.WithCancel(a.ctx)`
3. Store cancel functions in session registry for explicit cleanup
4. Use uber-go/goleak in tests to detect leaks early
5. Monitor runtime.NumGoroutine() and alert on growth
6. Implement timeout contexts for SIP transactions (use Timer B default: 32s)
7. Never spawn goroutines without defer cleanup or context cancellation

**Detection:**
- Run `runtime.NumGoroutine()` periodically - growth indicates leak
- pprof goroutine profile shows blocked goroutines
- Memory usage grows even when sessions terminate
- Application becomes sluggish over hours

**Phase Impact:**
- Phase 2 (SIP Integration): Establish goroutine lifecycle patterns
- Phase 3 (Flow Execution): Concurrent flow execution amplifies leak risk
- Phase 4 (Production Readiness): Add monitoring and leak detection

**Sources:**
- [Go Concurrency Mastery: Preventing Goroutine Leaks](https://dev.to/serifcolakel/go-concurrency-mastery-preventing-goroutine-leaks-with-context-timeout-cancellation-best-1lg0)
- [Finding 50,000 Goroutine Leak](https://skoredin.pro/blog/golang/goroutine-leak-debugging)
- [diago Invite thread safety warning](https://github.com/emiago/diago)
- [Wails OnShutdown not called in dev mode](https://github.com/wailsapp/wails/issues/2421)

**Confidence:** HIGH (Official documentation + documented case studies)

---

### Pitfall 3: SQLite Concurrent Access Database Locked Errors

**What goes wrong:**
Multiple goroutines attempt simultaneous writes to SQLite database, causing "database is locked" errors, transaction failures, and potential data corruption. mattn/go-sqlite3 explicitly does NOT support concurrent access.

**Why it happens:**
- SQLite uses file-level locking - only one writer at a time
- mattn/go-sqlite3 (most popular Go driver) has poor concurrent access handling
- Flow execution engine + SIP event logger + UI state saver all write simultaneously
- database/sql connection pooling doesn't solve SQLite write serialization
- WAL mode helps but doesn't eliminate contention

**Consequences:**
- Flow execution results lost due to write failures
- SIP event logs incomplete
- UI state corruption when save fails silently
- User loses work during concurrent operations

**Prevention:**
1. Use single-writer pattern: dedicated goroutine owns all writes
2. Implement write queue with channel: `writeChan := make(chan writeRequest, 100)`
3. Consider alternative SQLite drivers designed for concurrency:
   - github.com/ncruces/go-sqlite3 (goroutine-safe with proper usage)
   - zombiezen.com/go/sqlite (explicit connection pooling)
4. Enable WAL mode: `PRAGMA journal_mode=WAL`
5. Set busy timeout: `PRAGMA busy_timeout=5000`
6. Use transactions for batch operations
7. Separate read connections (pooled) from single write connection

**Detection:**
- "database is locked" errors in logs
- Write operations fail intermittently
- Higher failure rate under load/concurrent testing
- Race detector shows data races around SQL execution

**Phase Impact:**
- Phase 1 (Foundation): Establish SQLite access pattern BEFORE adding concurrency
- Phase 3 (Flow Execution): Write queue critical for logging execution events
- Phase 4 (Production): Monitoring for write queue depth/failures

**Sources:**
- [mattn/go-sqlite3 concurrency problems](https://github.com/mattn/go-sqlite3/issues/1179)
- [SQLite concurrent access in Go discussion](https://groups.google.com/g/golang-nuts/c/y7WzUsMtqDA)
- [Making SQLite faster in Go](https://turriate.com/articles/making-sqlite-faster-in-go)

**Confidence:** HIGH (Official library documentation + community issues)

---

### Pitfall 4: React Flow Performance Collapse with Large Graphs

**What goes wrong:**
Flow designer becomes unusable with 100+ nodes. Dragging background lags, node selection freezes, rendering takes seconds. Problem compounds with custom nodes containing handles.

**Why it happens:**
- **nodeTypes defined inside component render** - creates new object every render, forces full re-render
- Each custom node re-renders on ANY state change without memoization
- 100 nodes with 2 handles each = 200 handle components = 300+ DOM elements
- Unoptimized selectors trigger cascading re-renders
- Animation/zoom triggers render of ALL nodes, not just visible ones

**Consequences:**
- Designer unusable for realistic SIP flows (typical flow: 50-200 nodes)
- User unable to design complex scenarios
- Frame rate drops make animation sync impossible
- Project appears abandoned due to poor UX

**Prevention:**
1. **CRITICAL:** Define nodeTypes OUTSIDE component or useMemo:
   ```typescript
   const nodeTypes = useMemo(() => ({ sipNode: SIPNode }), []);
   ```
2. Memoize custom node components with React.memo
3. Use shallow selectors - don't select entire nodes array:
   ```typescript
   // BAD: const nodes = useNodes();
   // GOOD: const node = useStore(nodeSelector);
   ```
4. Implement virtualization for large graphs (only render visible viewport)
5. Debounce position updates during drag operations
6. Use `updateNode` helper instead of full state replacement
7. Profile with React DevTools to find re-render hotspots

**Detection:**
- Profiler shows 100ms+ render times
- Dragging background feels janky
- Chrome DevTools Performance shows long tasks
- Frame rate drops below 30fps with 50+ nodes

**Phase Impact:**
- Phase 1 (Foundation): Establish performance patterns BEFORE building features
- Phase 2 (Visual Designer): Critical for core UX
- Phase 3 (Flow Execution): Animation sync impossible if base rendering slow

**Sources:**
- [React Flow Performance Documentation](https://reactflow.dev/learn/advanced-use/performance)
- [nodeTypes anti-pattern issue](https://github.com/xyflow/xyflow/discussions/4975)
- [10k nodes performance issue](https://github.com/xyflow/xyflow/issues/3044)
- [React Flow Optimization Guide](https://dev.to/usman_abdur_rehman/react-flowxyflow-optimization-45ik)

**Confidence:** HIGH (Official documentation + multiple GitHub issues)

---

### Pitfall 5: SIP Timer Mismanagement Causing Transaction Failures

**What goes wrong:**
SIP transactions fail due to incorrect timer handling - retransmissions stop too early, transactions timeout prematurely, or timers never fire. Causes call setup failures that work in one network but fail in production.

**Why it happens:**
- RFC 3261 defines complex timer hierarchy (T1, T2, T4, Timer A-K)
- Timer T1 (RTT estimate, default 500ms) scales other timers exponentially
- Timer B (INVITE timeout, 64*T1 = 32s) abandons transaction if no response
- Developers hardcode timeouts instead of using RFC-compliant exponential backoff
- Network conditions vary (LAN vs WAN vs mobile) - fixed timeouts fail
- Goroutine-based timers not cancelled on early response

**Consequences:**
- Call setup fails on slow networks (mobile, satellite)
- Retransmissions flood network or stop too early
- Impossible to interoperate with RFC-compliant SIP servers
- Works in dev (low latency) but fails in production (real networks)

**Prevention:**
1. Use diago's built-in timer management - don't implement custom timers
2. Understand timer relationships:
   - Timer A (retransmit): 0ms, 500ms, 1s, 2s, 4s, 8s, 16s, 32s (exponential)
   - Timer B (timeout): 64*T1 = 32s
   - Timer F (non-INVITE timeout): 64*T1 = 32s
3. Make T1 configurable per network environment (LAN: 500ms, WAN: 1000ms)
4. Cancel timers immediately on receiving response
5. Log timer events for debugging: "Timer A fired (retry 3/8)"
6. Test with network delay simulation (tc qdisc add delay 200ms)

**Detection:**
- Transaction timeouts in logs after exactly 32 seconds
- Retransmissions occur at wrong intervals
- Call setup works locally but fails over Internet
- Wireshark shows missing retransmissions or timing violations

**Phase Impact:**
- Phase 2 (SIP Integration): Critical for basic call setup reliability
- Phase 3 (Flow Execution): Timer bugs cause non-deterministic flow failures
- Phase 4 (Production): Network variability exposes timer issues

**Sources:**
- [SIP Timer and Retransmission Guide](https://thanhloi2603.wordpress.com/2018/10/20/sip-timer-retransmission/)
- [Understanding SIP Timers Part I](https://andrewjprokop.wordpress.com/2013/07/02/understanding-sip-timers-part-i/)
- [RFC 4321: SIP Non-INVITE Transaction Problems](https://www.rfc-editor.org/rfc/rfc4321)

**Confidence:** MEDIUM (RFC documentation + community guides, but older sources)

---

## Moderate Pitfalls

Mistakes that cause delays, technical debt, or require significant rework.

---

### Pitfall 6: Undo/Redo State Explosion

**What goes wrong:**
Undo/redo system saves state on every interaction, consuming memory and creating useless undo steps. Clicking a node (without dragging) saves history, requiring multiple undos to reach previous state.

**Why it happens:**
- React Flow's onNodesChange fires with `type:position, dragging:false` on click
- Naive implementation pushes state snapshot on EVERY change event
- Complete state snapshots for 100-node graph = 100KB+ per undo step
- No debouncing of rapid changes (drag generates 60+ events/second)

**Consequences:**
- Memory grows unbounded with usage
- Undo requires 5-10 clicks to see actual change
- Poor UX - users frustrated by undo behavior
- Browser tab crashes on memory exhaustion

**Prevention:**
1. Filter change events - only save on meaningful changes:
   ```typescript
   if (change.type === 'position' && !change.dragging) return; // Don't save click
   ```
2. Debounce state saves during drag: save on drag END, not during
3. Implement differential undo: store changes, not full snapshots
4. Limit history depth (e.g., 50 steps) with circular buffer
5. Use command pattern for complex operations (add node = one undo step)
6. Clear redo stack when new action occurs (standard undo behavior)

**Detection:**
- Memory grows during normal editing
- Undo doesn't return to expected previous state
- Performance degrades after extended editing session

**Phase Impact:**
- Phase 2 (Visual Designer): Implement with change filtering from start
- Phase 3 (Flow Execution): Execution results should NOT create undo steps

**Sources:**
- [React Flow undo/redo discussion](https://github.com/xyflow/xyflow/discussions/3364)
- [Undo/Redo functionality patterns](https://app.studyraid.com/en/read/11730/371572/undoredo-functionality)
- [React Flow Undo/Redo Example](https://reactflow.dev/examples/interaction/undo-redo)

**Confidence:** MEDIUM (Community discussions + documented patterns)

---

### Pitfall 7: Wails Build vs Dev Environment Divergence

**What goes wrong:**
Application works perfectly in `wails dev` but fails in production build from `wails build`. Runtime methods don't work, events fail, assets missing, or startup crashes.

**Why it happens:**
- `wails dev` uses different asset serving mechanism than production
- OnDomReady fires at different times in dev vs build
- OnShutdown not called in dev mode during hot reload
- Build optimizations change timing of initialization
- Frontend assumes dev server features (hot reload, error overlay)

**Consequences:**
- Critical bugs only discovered at release time
- Wasted development time debugging production-only issues
- Emergency patches needed post-release
- User trust damaged by broken releases

**Prevention:**
1. Test production builds regularly during development (weekly minimum)
2. Avoid dev-only features in production code (check build mode)
3. Don't rely on OnDomReady timing - use explicit ready signals
4. Use same asset embedding strategy in dev and prod
5. Add smoke tests that run against production build
6. CI pipeline must test both `wails dev` AND `wails build`

**Detection:**
- "Cannot read properties of undefined (reading 'EventsOff')" in prod
- Runtime methods work in dev but fail in build
- Different behavior on startup/shutdown
- Assets load in dev but 404 in build

**Phase Impact:**
- Phase 1 (Foundation): Establish build testing from beginning
- Phase 4 (Production): Critical for release confidence

**Sources:**
- [Cannot use runtime methods in build](https://github.com/wailsapp/wails/issues/1206)
- [OnShutdown not called in dev](https://github.com/wailsapp/wails/issues/2421)
- [Cannot read properties error](https://github.com/wailsapp/wails/issues/3781)

**Confidence:** HIGH (GitHub issues with reproducible cases)

---

### Pitfall 8: SIP One-Way Audio (RTP Path Failures)

**What goes wrong:**
SIP call establishes successfully, but only one party hears audio. RTP packets flow in one direction but not the other. Affects call testing and validation features.

**Why it happens:**
- NAT/firewall blocks return RTP path (most common: 80% of cases)
- SDP contains non-routable private IP (e.g., 192.168.x.x sent to remote)
- RTP port not opened in firewall
- Asymmetric routing - outbound works but inbound blocked
- ICE/STUN not used for NAT traversal
- Media relay not implemented for cross-NAT scenarios

**Consequences:**
- Flow designer can initiate calls but can't verify audio quality
- User thinks SIP implementation is broken
- Impossible to test real-world call scenarios
- QA cannot validate audio path in flows

**Prevention:**
1. Implement STUN for NAT traversal and public IP discovery
2. Use TURN relay for symmetric NAT scenarios
3. Validate SDP before sending: check IP routability
4. Open RTP port range in firewall (typically 10000-20000)
5. Log RTP statistics: packets sent/received, jitter, loss
6. Add RTP echo test feature for diagnosing audio path
7. Detect NAT scenario and warn user if relay needed

**Detection:**
- Wireshark shows RTP packets in one direction only
- RTCP statistics show 0 packets received
- SDP contains 192.168.x.x or 10.x.x.x addresses
- Firewall logs show blocked RTP packets

**Phase Impact:**
- Phase 2 (SIP Integration): Basic call setup might hide this issue
- Phase 3 (Flow Execution): Critical for call validation features
- Phase 4 (Production): Network variability exposes NAT issues

**Sources:**
- [Troubleshooting one-way audio](https://blog.opensips.org/2023/07/06/troubleshooting-one-way-audio-calls/)
- [SIP One-Way Audio with RTP packets present](https://community.fortinet.com/t5/FortiGate/Technical-Tip-SIP-One-Way-Audio-Even-With-RTP-Packets-Present/ta-p/399717)
- [Causes of no-audio and one-way-audio](https://blog.kolmisoft.com/the-causes-of-no-audio-and-one-way-audio-voip-calls/)

**Confidence:** HIGH (Official troubleshooting guides + vendor documentation)

---

### Pitfall 9: Flow Execution Order Non-Determinism

**What goes wrong:**
Visual flow execution produces different results each run despite identical input. Race conditions in parallel branches cause timing-dependent behavior.

**Why it happens:**
- Parallel flow branches execute in goroutines without synchronization
- No happens-before guarantees between node executions
- SIP async responses arrive in unpredictable order
- Shared state accessed without mutex protection
- Flow engine doesn't enforce dependency ordering

**Consequences:**
- Flows work 90% of time but fail randomly in production
- Impossible to reproduce bugs
- Users lose confidence in tool reliability
- Test results inconsistent

**Prevention:**
1. Implement explicit dependency graph before execution
2. Use channels for inter-node communication (enforces ordering)
3. Synchronize parallel branches with WaitGroup or channels
4. Add execution sequence numbers to trace actual order
5. Make SIP operations synchronous within flow context
6. Implement deterministic test mode with controlled timing
7. Log execution order for post-mortem analysis

**Detection:**
- Same flow produces different results
- Timing-dependent failures (works when stepped through debugger)
- Race detector finds data races during execution
- Execution logs show variable node ordering

**Phase Impact:**
- Phase 3 (Flow Execution): Critical for execution engine design
- Phase 4 (Production): Determinism required for QA use case

**Sources:**
- [Visual dataflow programming control mechanisms](https://ieeexplore.ieee.org/document/5234876/)
- [Flow-based programming patterns](https://en.wikipedia.org/wiki/Flow-based_programming)

**Confidence:** MEDIUM (Academic research + general programming patterns)

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable without major rework.

---

### Pitfall 10: Wails Custom Struct Serialization Failures

**What goes wrong:**
EventsEmit with custom Go struct arrives at frontend as empty object `{}` instead of populated data. Forcing developers to emit primitive types or individual fields.

**Why it happens:**
- Go struct fields must be exported (uppercase) for JSON marshaling
- Struct tags may be missing or incorrect
- Nested structs with unexported fields fail silently
- Pointer fields serialize differently than value fields
- Time/custom types need MarshalJSON implementation

**Consequences:**
- Boilerplate code extracting struct fields to maps
- Type safety lost in Go code
- Frontend receives incomplete data
- Development friction and confusion

**Prevention:**
1. Always export struct fields (uppercase first letter):
   ```go
   type SIPEvent struct {
       CallID string `json:"callId"`  // NOT: callId string
       State  string `json:"state"`
   }
   ```
2. Add JSON tags for frontend naming conventions
3. Test serialization in unit tests:
   ```go
   data, _ := json.Marshal(event)
   fmt.Println(string(data)) // Verify output
   ```
4. Use online JSON to Go struct tools for validation
5. Document serialization requirements in development guide

**Detection:**
- Frontend receives `{}` instead of populated object
- Console.log shows empty or missing fields
- EventsEmit works with primitives but fails with structs

**Phase Impact:**
- Phase 1 (Foundation): Establish struct patterns early
- Phase 2 (SIP Integration): SIP events need proper serialization

**Sources:**
- [EventsEmit custom struct issue](https://github.com/wailsapp/wails/issues/1037)
- [Wails Event System Documentation](https://wails.io/docs/reference/runtime/events/)

**Confidence:** HIGH (GitHub issue + official documentation)

---

### Pitfall 11: React Flow Edge Routing Performance

**What goes wrong:**
Edge rendering becomes slow with complex paths or many overlapping edges. Bezier curves recalculate on every render, causing frame drops.

**Why it happens:**
- Default bezier edge calculation is expensive
- Edge components re-render on ANY graph change
- Overlapping edges create complex SVG paths
- No edge virtualization - all edges render always

**Consequences:**
- Graph feels sluggish during interaction
- Edge animation stutters
- Designer UX suffers with realistic flows (50+ edges)

**Prevention:**
1. Use memoized edge components with React.memo
2. Prefer simpler edge types (straight, step) over bezier for complex graphs
3. Implement edge bundling for parallel edges
4. Consider canvas renderer for edges (experimental but faster)
5. Debounce edge updates during node dragging

**Detection:**
- Profiler shows edge component render time > 16ms
- Frame rate drops when dragging nodes with many edges
- SVG path complexity visible in DevTools

**Phase Impact:**
- Phase 2 (Visual Designer): Address if performance issues appear
- Phase 3 (Flow Execution): Edge animation quality matters

**Sources:**
- [React Flow Performance Guide](https://reactflow.dev/learn/advanced-use/performance)
- [Performance issues at zoom levels](https://github.com/xyflow/xyflow/discussions/4617)

**Confidence:** MEDIUM (Official documentation mentions issue but solutions vary)

---

### Pitfall 12: SQLite Schema Migration Without Versioning

**What goes wrong:**
Database schema changes break existing installations. Users lose data on upgrade or application crashes on startup with schema mismatch.

**Why it happens:**
- No migration system - direct schema changes
- Version number not tracked in database
- Assumes fresh install every time
- No rollback mechanism for failed migrations

**Consequences:**
- Users lose flow designs on upgrade
- Application unusable after update
- Support burden from broken installations
- Poor upgrade experience damages reputation

**Prevention:**
1. Use migration library (e.g., golang-migrate/migrate)
2. Store schema version in database:
   ```sql
   CREATE TABLE schema_version (version INTEGER PRIMARY KEY);
   ```
3. Apply migrations incrementally on startup
4. Write up and down migrations for rollback
5. Test migration paths in CI (version N to N+1, N to N+2)
6. Backup database before migration

**Detection:**
- SQL errors on startup after code update
- Missing columns in queries
- Schema mismatch errors in logs

**Phase Impact:**
- Phase 1 (Foundation): Implement before first release
- Ongoing: Every schema change requires migration

**Sources:**
- [SQLite persistent storage](https://sqlite.org/wasm/doc/trunk/persistence.md)
- [Desktop app SQLite patterns](https://copyprogramming.com/howto/sql-flutter-desktop-app-with-sqflite-local-database)

**Confidence:** MEDIUM (General database best practices)

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation | Priority |
|-------------|---------------|------------|----------|
| **Foundation** | Event system race conditions | Implement handshake protocol before SIP integration | CRITICAL |
| **Foundation** | SQLite concurrent access pattern | Establish single-writer pattern from beginning | CRITICAL |
| **Foundation** | React Flow performance patterns | Define nodeTypes outside component, use memoization | HIGH |
| **SIP Integration** | Goroutine leaks in session management | Context-based lifecycle, leak detection tests | CRITICAL |
| **SIP Integration** | Timer management violations | Use diago built-in timers, test with network delay | HIGH |
| **SIP Integration** | Custom struct serialization | Exported fields with JSON tags | MEDIUM |
| **Visual Designer** | Undo/redo state explosion | Filter change events, implement debouncing | MEDIUM |
| **Visual Designer** | Edge routing performance | Memoized edges, simpler edge types | LOW |
| **Flow Execution** | Non-deterministic execution order | Dependency graph, channel-based coordination | CRITICAL |
| **Flow Execution** | Animation sync with async events | Event queuing, timestamp-based sync | HIGH |
| **Flow Execution** | SIP one-way audio in validation | STUN/TURN implementation, RTP diagnostics | HIGH |
| **Production** | Build vs dev divergence | Regular production build testing | HIGH |
| **Production** | Schema migration failures | Migration system before first release | MEDIUM |

---

## Testing Recommendations

To detect these pitfalls early:

**Unit Tests:**
- Goroutine leak detection with uber-go/goleak
- Event serialization validation
- SQLite concurrent access stress tests
- SIP timer sequence validation

**Integration Tests:**
- Wails event round-trip with timing checks
- Flow execution determinism (run same flow 100x)
- Production build smoke tests
- Database migration path testing

**Performance Tests:**
- React Flow with 100+ nodes
- Sustained SIP session count (memory leak detection)
- SQLite write queue depth monitoring
- Frame rate measurement during interaction

**Network Tests:**
- SIP with simulated latency (tc qdisc)
- RTP path validation across NAT
- Timer behavior under packet loss
- One-way audio detection

---

## Confidence Assessment

| Area | Confidence | Rationale |
|------|------------|-----------|
| **Wails Issues** | HIGH | GitHub issues with reproducible cases, official docs |
| **React Flow Performance** | HIGH | Official performance guide + multiple reported issues |
| **SQLite Concurrency** | HIGH | Official library documentation + community consensus |
| **Goroutine Leaks** | HIGH | Documented case studies + official Go patterns |
| **SIP Timers** | MEDIUM | RFC documentation (authoritative) but older community guides |
| **SIP Audio Issues** | HIGH | Official troubleshooting guides from vendors |
| **Flow Execution** | MEDIUM | General programming patterns, less domain-specific |
| **diago Library** | MEDIUM | Official docs available but limited community usage data |

---

## Research Gaps

Areas where deeper investigation may be needed during implementation:

1. **diago library edge cases** - Limited production usage documentation, may need experimentation
2. **Wails v3 migration** - v3 in development, API changes may affect some pitfalls
3. **React Flow canvas renderer** - Experimental feature for edge performance, stability unknown
4. **STUN/TURN integration with diago** - Specific implementation patterns not well documented
5. **Flow execution engine patterns** - Few references for SIP-specific visual programming

These gaps should be addressed with phase-specific research as needed.

---

## Summary

**Critical Focus Areas:**
1. Event system synchronization (affects all phases)
2. Goroutine lifecycle management (SIP reliability)
3. SQLite access patterns (data integrity)
4. React Flow performance (core UX)

**Key Success Factors:**
- Establish foundational patterns in Phase 1 BEFORE adding complexity
- Test production builds regularly, not just at release
- Implement monitoring/detection for leaks and race conditions early
- Validate SIP behavior with network variability testing

**Biggest Risk:**
Race conditions in event system and goroutine management will compound as features are added. Get these right in foundation or face expensive rewrites.
