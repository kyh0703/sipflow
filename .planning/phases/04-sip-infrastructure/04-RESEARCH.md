# Phase 4: SIP Infrastructure - Research

**Researched:** 2026-02-02
**Domain:** SIP User Agent lifecycle management with diago/sipgo
**Confidence:** HIGH

## Summary

Phase 4 establishes the SIP infrastructure layer: configuring external SIP server connections (INFR-01) and managing diago UA instances per SIP Instance node (INFR-03). This phase is purely infrastructure -- no call commands are executed yet (those are Phase 5+).

The diago library (v0.26.2) provides a high-level API built on sipgo for creating SIP User Agents. Each `Diago` instance wraps a `sipgo.UserAgent` and supports transport configuration (UDP/TCP/TLS/WS), SIP registration with auto-renewal, and debug tracing. The key lifecycle is: `sipgo.NewUA()` -> `diago.NewDiago(ua, opts...)` -> optionally `Register()` -> use -> `ua.Close()`. The architecture document's pseudo-code contains API inaccuracies (e.g., `diago.NewUA` does not exist), which this research corrects.

**Primary recommendation:** Create a `SIPService` handler (bound to Wails) that manages SIP server CRUD in SQLite, and a `UAManager` component that creates/destroys `*diago.Diago` instances keyed by SIP Instance node ID, with context-based lifecycle and goroutine leak testing via uber-go/goleak.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| github.com/emiago/diago | v0.26.2 | High-level SIP UA (dialog, registration, media) | Already selected; provides dialog management over raw sipgo |
| github.com/emiago/sipgo | (transitive via diago) | Low-level SIP stack (RFC 3261) | Foundation of diago; needed for `sipgo.NewUA()` and `sipgo.DigestAuth` |
| go.uber.org/goleak | latest | Goroutine leak detection in tests | Industry standard; success criterion #3 requires leak verification |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| log/slog | stdlib | Structured logging for SIP trace | Pass to `diago.WithLogger()` for SIP message capture |
| github.com/emiago/sipgo/sip | (transitive) | SIP message types, URI parsing | `sip.SIPDebug = true` for trace; `sip.ParseUri()` for targets |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| diago for UA | Raw sipgo | Much more code; diago already handles dialog/session/media lifecycle |
| goleak for leak detection | runtime.NumGoroutine() manual check | goleak is more precise, identifies specific leaked goroutines |

**Installation:**
```bash
cd /Users/kyh0703/Project/sipflow
go get github.com/emiago/diago@latest
go get go.uber.org/goleak@latest
```

Note: diago is NOT currently in go.mod despite being listed as "already in go.mod" in prior context. It must be added.

## Architecture Patterns

### Recommended Project Structure
```
internal/
  handler/
    sip_service.go       # Wails-bound: SIP server CRUD, UA start/stop
  domain/
    sip_server.go        # SIP server config domain model
  infra/
    sip/
      ua_manager.go      # UA lifecycle: create, register, destroy
      sip_logger.go      # Custom slog handler for SIP trace capture

ent/schema/
  sipserver.go           # ent schema for SIP server configuration
```

### Pattern 1: UA Manager with Context-Based Lifecycle
**What:** Central registry that maps node IDs to `*diago.Diago` instances, using `context.Context` for graceful shutdown.
**When to use:** Always. Every UA instance must be tracked for cleanup.
**Example:**
```go
// Source: verified from pkg.go.dev/github.com/emiago/diago API docs
type UAManager struct {
    mu      sync.RWMutex
    uas     map[string]*managedUA  // nodeID -> managedUA
    log     *slog.Logger
}

type managedUA struct {
    dg     *diago.Diago
    ua     *sipgo.UserAgent
    cancel context.CancelFunc
}

func (m *UAManager) CreateUA(nodeID string, cfg UAConfig) error {
    ua, err := sipgo.NewUA(
        sipgo.WithUserAgent(cfg.DisplayName),
    )
    if err != nil {
        return fmt.Errorf("create sipgo UA: %w", err)
    }

    transport := diago.Transport{
        Transport: strings.ToLower(cfg.Transport), // "udp", "tcp", "tls"
        BindHost:  "0.0.0.0",
        BindPort:  0, // ephemeral port
    }

    dg := diago.NewDiago(ua,
        diago.WithTransport(transport),
        diago.WithLogger(m.log.With("node", nodeID)),
    )

    ctx, cancel := context.WithCancel(context.Background())

    m.mu.Lock()
    m.uas[nodeID] = &managedUA{dg: dg, ua: ua, cancel: cancel}
    m.mu.Unlock()

    // If registration is configured
    if cfg.RegisterURI != "" {
        go func() {
            // Register blocks until error or context cancel
            err := dg.Register(ctx, cfg.RegisterURI, diago.RegisterOptions{
                Username: cfg.Username,
                Password: cfg.Password,
                Expiry:   3600 * time.Second,
            })
            if err != nil && !errors.Is(err, context.Canceled) {
                m.log.Error("registration failed", "node", nodeID, "err", err)
            }
        }()
    }

    return nil
}

func (m *UAManager) DestroyUA(nodeID string) error {
    m.mu.Lock()
    managed, ok := m.uas[nodeID]
    if ok {
        delete(m.uas, nodeID)
    }
    m.mu.Unlock()

    if !ok {
        return fmt.Errorf("UA not found: %s", nodeID)
    }

    // Cancel context stops registration loop and any active operations
    managed.cancel()
    // Close sipgo UA releases transport listeners and transactions
    return managed.ua.Close()
}

func (m *UAManager) DestroyAll() {
    m.mu.Lock()
    ids := make([]string, 0, len(m.uas))
    for id := range m.uas {
        ids = append(ids, id)
    }
    m.mu.Unlock()

    for _, id := range ids {
        m.DestroyUA(id)
    }
}
```

### Pattern 2: SIP Server Configuration in ent
**What:** Persist SIP server configs (proxy/registrar address, transport, credentials) in SQLite via ent ORM.
**When to use:** INFR-01 requirement. Replace mock data in serverStore.
**Example:**
```go
// ent/schema/sipserver.go
func (SIPServer) Fields() []ent.Field {
    return []ent.Field{
        field.String("name").NotEmpty(),
        field.String("address").NotEmpty(),
        field.Int("port").Default(5060),
        field.String("transport").Default("UDP"), // UDP, TCP, TLS
        field.String("username").Optional().Default(""),
        field.String("password").Optional().Sensitive().Default(""),
        field.Time("created_at").Immutable().Default(time.Now),
        field.Time("updated_at").Default(time.Now).UpdateDefault(time.Now),
    }
}
```

### Pattern 3: SIP Trace Log Capture
**What:** Intercept SIP debug output and forward to frontend via Wails events.
**When to use:** Success criterion #4 - user can see SIP message traces.
**Example:**
```go
// Enable SIP debug globally
sip.SIPDebug = true

// Custom slog handler that captures SIP messages and emits to frontend
type SIPTraceHandler struct {
    slog.Handler
    emitter *handler.EventEmitter
}

func (h *SIPTraceHandler) Handle(ctx context.Context, r slog.Record) error {
    // Forward SIP trace messages to frontend
    h.emitter.Emit("sip:trace", map[string]interface{}{
        "time":    r.Time.Format(time.RFC3339Nano),
        "level":   r.Level.String(),
        "message": r.Message,
    })
    return h.Handler.Handle(ctx, r)
}
```

### Pattern 4: SIPService Handler (Wails-Bound)
**What:** Handler service following existing FlowService/ProjectService pattern.
**When to use:** All SIP server CRUD and UA management exposed to frontend.
**Example:**
```go
type SIPService struct {
    entClient *ent.Client
    uaManager *sip.UAManager
    emitter   *EventEmitter
}

// CRUD for SIP server configuration
func (s *SIPService) ListServers() Response[[]SIPServerMeta] { ... }
func (s *SIPService) CreateServer(req CreateServerRequest) Response[int] { ... }
func (s *SIPService) UpdateServer(id int, req UpdateServerRequest) Response[bool] { ... }
func (s *SIPService) DeleteServer(id int) Response[bool] { ... }

// UA lifecycle
func (s *SIPService) StartUA(nodeID string, serverID int) Response[bool] { ... }
func (s *SIPService) StopUA(nodeID string) Response[bool] { ... }
func (s *SIPService) StopAllUAs() Response[bool] { ... }
func (s *SIPService) GetUAStatus(nodeID string) Response[string] { ... }
```

### Anti-Patterns to Avoid
- **Creating UA without tracking:** Every `sipgo.NewUA()` MUST be tracked for `Close()`. Leaking a UA leaks goroutines and ports.
- **Blocking Wails handler with Register():** `diago.Register()` blocks until error/cancel. Always run in a goroutine with cancellable context.
- **Using `diago.NewUA`:** This function does NOT exist. The correct pattern is `sipgo.NewUA()` then `diago.NewDiago(ua)`. The architecture document contains this error.
- **Shared UA for multiple nodes:** Each SIP Instance node needs its own `sipgo.UserAgent` + `diago.Diago` instance. They represent independent UAs with different identities.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SIP transport management | Custom UDP/TCP listeners | `diago.WithTransport(Transport{...})` | Handles bind, NAT, connection reuse |
| SIP registration renewal | Timer-based re-register loop | `diago.Register(ctx, ...)` with `Expiry` option | Auto-renews until context cancelled |
| SIP message parsing | Custom SIP parser | `sipgo/sip` package | RFC 3261 compliant, battle-tested |
| Goroutine leak testing | Manual goroutine counting | `go.uber.org/goleak` | Identifies specific leaked goroutines by stack trace |
| Digest authentication | Custom digest auth | `diago.WithAuth(sipgo.DigestAuth{...})` / `RegisterOptions{Username, Password}` | Handles nonce, realm, qop correctly |

**Key insight:** diago's lifecycle management (especially `Register()` with auto-renewal and context cancellation) eliminates the most error-prone custom code. The main risk is forgetting to call `ua.Close()`.

## Common Pitfalls

### Pitfall 1: Goroutine Leak from Unclosed UAs
**What goes wrong:** Creating `sipgo.NewUA()` spawns transport listeners. If `ua.Close()` is never called (e.g., error path, app crash), goroutines leak.
**Why it happens:** Happy-path-only coding. Error paths skip cleanup.
**How to avoid:**
- Always defer `ua.Close()` immediately after creation in tests
- Use UAManager pattern with `DestroyAll()` in app shutdown
- Test with `goleak.VerifyNone(t)` in every UA-related test
**Warning signs:** `runtime.NumGoroutine()` increases over time; port binding failures on restart.

### Pitfall 2: Register() Blocks Forever
**What goes wrong:** `diago.Register()` is a blocking call that auto-renews registration. If called on main goroutine or without cancellable context, it blocks the handler.
**Why it happens:** API looks like a simple function but has blocking loop behavior.
**How to avoid:** Always call in a goroutine with `context.WithCancel`. Cancel the context to stop registration.
**Warning signs:** Wails handler never returns; UI freezes.

### Pitfall 3: Port Conflicts with Multiple UAs
**What goes wrong:** Multiple `diago.Diago` instances try to bind to port 5060.
**Why it happens:** Default transport binds to 127.0.0.1:5060. Creating second UA fails.
**How to avoid:** Use `BindPort: 0` (ephemeral port) for all UAs, or assign unique ports.
**Warning signs:** "address already in use" errors on second UA creation.

### Pitfall 4: SIPDebug Global State
**What goes wrong:** `sip.SIPDebug = true` is a global variable. It affects ALL SIP instances in the process.
**Why it happens:** Library design uses package-level variables for debug flags.
**How to avoid:** This is fine for our use case (desktop app, user toggles trace). Just be aware it's all-or-nothing.
**Warning signs:** N/A - just a design awareness item.

### Pitfall 5: Missing ent Schema Migration
**What goes wrong:** Adding `sipserver` ent schema requires regenerating ent code and migrating existing SQLite databases.
**Why it happens:** ent auto-migration must be re-run with new schema.
**How to avoid:** Run `go generate ./ent` after adding schema. Auto-migration on app startup handles schema changes.
**Warning signs:** "no such table: sip_servers" runtime error.

### Pitfall 6: Invite() Not Thread Safe
**What goes wrong:** Concurrent calls to `diago.Invite()` on the same instance can cause race conditions.
**Why it happens:** Documented limitation in diago library.
**How to avoid:** Phase 4 does NOT execute calls (that's Phase 5+). But when we get there, serialize Invite calls per UA instance or use separate UAs.
**Warning signs:** Race detector failures, SIP message corruption.

## Code Examples

### Creating a Diago Instance with Transport
```go
// Source: pkg.go.dev/github.com/emiago/diago - verified API
import (
    "github.com/emiago/diago"
    "github.com/emiago/sipgo"
)

ua, err := sipgo.NewUA(
    sipgo.WithUserAgent("SIPFlow/1.0"),
)
if err != nil {
    return err
}

transport := diago.Transport{
    Transport: "udp",    // "udp", "tcp", "tls", "ws"
    BindHost:  "0.0.0.0",
    BindPort:  0,         // 0 = ephemeral (OS assigns free port)
}

dg := diago.NewDiago(ua,
    diago.WithTransport(transport),
    diago.WithLogger(slog.Default()),
)
```

### Registration with Auto-Renewal
```go
// Source: pkg.go.dev/github.com/emiago/diago - RegisterOptions
import "github.com/emiago/sipgo/sip"

ctx, cancel := context.WithCancel(context.Background())
defer cancel() // stops registration loop

registrar, _ := sip.ParseUri("sip:proxy.example.com:5060")
err := dg.Register(ctx, registrar, diago.RegisterOptions{
    Username:      "alice",
    Password:      "secret",
    Expiry:        3600 * time.Second,
    RetryInterval: 300 * time.Second,
})
// Blocks until ctx is cancelled or unrecoverable error
```

### Registration with Transaction (Granular Control)
```go
// Source: pkg.go.dev/github.com/emiago/diago - RegisterTransaction
registrar, _ := sip.ParseUri("sip:proxy.example.com:5060")
regTx, err := dg.RegisterTransaction(ctx, registrar, diago.RegisterOptions{
    Username: "alice",
    Password: "secret",
    Expiry:   3600 * time.Second,
})
if err != nil {
    return err
}

// Register once
err = regTx.Register(ctx)

// Health check
err = regTx.Qualify(ctx)  // sends OPTIONS ping

// Periodic health check loop
go regTx.QualifyLoop(ctx) // blocks until ctx cancel

// Clean unregister
err = regTx.Unregister(ctx)
```

### Enabling SIP Trace Logging
```go
// Source: github.com/emiago/diago README - Debug section
import "github.com/emiago/sipgo/sip"

// Global toggle - affects all SIP in the process
sip.SIPDebug = true  // SIP message send/receive trace
```

### Goroutine Leak Test
```go
// Source: github.com/uber-go/goleak README
import "go.uber.org/goleak"

func TestUAManager_CreateAndDestroy(t *testing.T) {
    defer goleak.VerifyNone(t,
        goleak.IgnoreAnyFunction("internal/poll.runtime_pollWait"),
    )

    mgr := NewUAManager(slog.Default())
    cfg := UAConfig{
        Transport: "udp",
        BindPort:  0,
    }

    err := mgr.CreateUA("test-node-1", cfg)
    require.NoError(t, err)

    err = mgr.DestroyUA("test-node-1")
    require.NoError(t, err)

    // goleak.VerifyNone checks no goroutines leaked after test
}
```

### Graceful Shutdown in Wails App
```go
// In app.go shutdown handler
func (a *App) shutdown(ctx context.Context) {
    // Stop all UAs before closing project
    a.sipService.StopAllUAs()
    // Close project (closes SQLite)
    a.projectService.CloseProject()
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `diago.NewUA()` (hypothetical) | `sipgo.NewUA()` + `diago.NewDiago(ua)` | Always been this way | Architecture doc has incorrect pseudo-code |
| `diago.Register()` simple call | `diago.Register()` OR `RegisterTransaction()` for granular control | v0.15.0+ | RegisterTransaction gives explicit register/unregister/qualify |
| No SRTP support | SRTP DTLS via `MediaConfig.SecureRTPAlg` | v0.26.0 | Available but not needed for Phase 4 |

**Deprecated/outdated:**
- Architecture document's `diago.NewUA()` pattern: Does not exist. Use `sipgo.NewUA()`.
- Architecture document's `DiagoSIPEngine.client *diago.Client`: Type does not exist. Use `*diago.Diago`.

## Open Questions

1. **SIP trace log format**
   - What we know: `sip.SIPDebug = true` writes to logger. diago accepts `WithLogger()`.
   - What's unclear: Exact format of SIP trace messages from sipgo. Need to test whether raw SIP messages (INVITE, 200 OK text) appear in log output or just summaries.
   - Recommendation: Implement basic trace capture, refine format after seeing actual output.

2. **Port management for many UAs**
   - What we know: Using `BindPort: 0` gives ephemeral ports. OS handles allocation.
   - What's unclear: Whether OS ephemeral port range could be exhausted with many simultaneous UAs (unlikely in desktop app context).
   - Recommendation: Use ephemeral ports. Desktop app unlikely to exceed OS limits.

3. **Frontend serverStore migration**
   - What we know: `serverStore.ts` exists with mock data and SIPInstancePanel uses it for server selection dropdown.
   - What's unclear: Whether to keep serverStore as a cache that syncs with backend, or replace entirely with backend calls.
   - Recommendation: Replace mock data with backend calls. serverStore becomes a thin cache populated by `SIPService.ListServers()` on app startup and after mutations.

4. **SIP server password storage security**
   - What we know: SQLite stores data locally. ent supports `Sensitive()` field annotation (redacts from logs).
   - What's unclear: Whether plaintext password storage in local SQLite is acceptable for a desktop dev/test tool.
   - Recommendation: Store plaintext for now (dev/test tool, local file). Add encryption in v2 if needed. Mark field as `Sensitive()` in ent schema to prevent log leakage.

## Sources

### Primary (HIGH confidence)
- [pkg.go.dev/github.com/emiago/diago](https://pkg.go.dev/github.com/emiago/diago) - Full API reference: NewDiago, Transport, Register, RegisterTransaction, DiagoOption types
- [emiago.github.io/diago/docs/api_docs](https://emiago.github.io/diago/docs/api_docs/) - Official API documentation: DialogServerSession, DialogClientSession, Media
- [github.com/emiago/diago](https://github.com/emiago/diago) - README, test patterns (diago_test.go)
- [pkg.go.dev/github.com/emiago/sipgo](https://pkg.go.dev/github.com/emiago/sipgo) - sipgo UserAgent, Server, Client lifecycle
- [github.com/uber-go/goleak](https://github.com/uber-go/goleak) - Goroutine leak detection API

### Secondary (MEDIUM confidence)
- [emiago.github.io/diago/docs/getting_started](https://emiago.github.io/diago/docs/getting_started/) - Basic usage patterns
- Existing codebase patterns (FlowService, ProjectService, serverStore) - verified by reading source

### Tertiary (LOW confidence)
- Architecture document's diago integration patterns - contains API inaccuracies, needs correction

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - verified against pkg.go.dev and official GitHub
- Architecture patterns: HIGH - based on verified diago API and existing codebase patterns
- Pitfalls: HIGH - goroutine leaks and blocking Register() verified from API docs; thread safety warning from prior research
- Code examples: HIGH - all verified against pkg.go.dev API signatures

**Research date:** 2026-02-02
**Valid until:** 2026-03-02 (diago is actively maintained, API relatively stable at v0.26.x)
