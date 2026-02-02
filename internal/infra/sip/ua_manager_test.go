package sip

import (
	"log/slog"
	"os"
	"testing"
	"time"

	"go.uber.org/goleak"
)

func defaultTestConfig() UAConfig {
	return UAConfig{
		DisplayName: "SIPFlow/test",
		Transport:   "udp",
		BindHost:    "127.0.0.1",
		BindPort:    0,
	}
}

func TestCreateUA(t *testing.T) {
	defer goleak.VerifyNone(t,
		goleak.IgnoreAnyFunction("internal/poll.runtime_pollWait"),
	)

	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	mgr := NewUAManager(logger)
	defer mgr.DestroyAll()

	err := mgr.CreateUA("node-1", defaultTestConfig())
	if err != nil {
		t.Fatalf("CreateUA should succeed: %v", err)
	}

	active := mgr.ListActive()
	if len(active) != 1 {
		t.Fatalf("expected 1 active UA, got %d", len(active))
	}
	if active[0].NodeID != "node-1" {
		t.Errorf("expected NodeID node-1, got %s", active[0].NodeID)
	}
	if !active[0].Active {
		t.Error("expected Active=true")
	}

	mgr.DestroyAll()
	time.Sleep(100 * time.Millisecond)
}

func TestCreateUA_Duplicate(t *testing.T) {
	defer goleak.VerifyNone(t,
		goleak.IgnoreAnyFunction("internal/poll.runtime_pollWait"),
	)

	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	mgr := NewUAManager(logger)
	defer func() {
		mgr.DestroyAll()
		time.Sleep(100 * time.Millisecond)
	}()

	cfg := defaultTestConfig()
	if err := mgr.CreateUA("node-1", cfg); err != nil {
		t.Fatalf("first CreateUA should succeed: %v", err)
	}

	err := mgr.CreateUA("node-1", cfg)
	if err == nil {
		t.Fatal("second CreateUA with same nodeID should return error")
	}
}

func TestDestroyUA(t *testing.T) {
	defer goleak.VerifyNone(t,
		goleak.IgnoreAnyFunction("internal/poll.runtime_pollWait"),
	)

	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	mgr := NewUAManager(logger)

	cfg := defaultTestConfig()
	if err := mgr.CreateUA("node-1", cfg); err != nil {
		t.Fatalf("CreateUA should succeed: %v", err)
	}

	err := mgr.DestroyUA("node-1")
	if err != nil {
		t.Fatalf("DestroyUA should succeed: %v", err)
	}

	active := mgr.ListActive()
	if len(active) != 0 {
		t.Fatalf("expected 0 active UAs, got %d", len(active))
	}

	time.Sleep(100 * time.Millisecond)
}

func TestDestroyUA_Nonexistent(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	mgr := NewUAManager(logger)

	err := mgr.DestroyUA("nonexistent")
	if err == nil {
		t.Fatal("DestroyUA with nonexistent nodeID should return error")
	}
}

func TestDestroyAll(t *testing.T) {
	defer goleak.VerifyNone(t,
		goleak.IgnoreAnyFunction("internal/poll.runtime_pollWait"),
	)

	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	mgr := NewUAManager(logger)

	cfg := defaultTestConfig()
	for _, id := range []string{"node-1", "node-2", "node-3"} {
		if err := mgr.CreateUA(id, cfg); err != nil {
			t.Fatalf("CreateUA(%s) should succeed: %v", id, err)
		}
	}

	active := mgr.ListActive()
	if len(active) != 3 {
		t.Fatalf("expected 3 active UAs, got %d", len(active))
	}

	mgr.DestroyAll()
	time.Sleep(100 * time.Millisecond)

	active = mgr.ListActive()
	if len(active) != 0 {
		t.Fatalf("expected 0 active UAs after DestroyAll, got %d", len(active))
	}
}

func TestGetStatus_Existing(t *testing.T) {
	defer goleak.VerifyNone(t,
		goleak.IgnoreAnyFunction("internal/poll.runtime_pollWait"),
	)

	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	mgr := NewUAManager(logger)
	defer func() {
		mgr.DestroyAll()
		time.Sleep(100 * time.Millisecond)
	}()

	cfg := defaultTestConfig()
	if err := mgr.CreateUA("node-1", cfg); err != nil {
		t.Fatalf("CreateUA should succeed: %v", err)
	}

	status, ok := mgr.GetStatus("node-1")
	if !ok {
		t.Fatal("GetStatus should return true for existing node")
	}
	if status.NodeID != "node-1" {
		t.Errorf("expected NodeID node-1, got %s", status.NodeID)
	}
	if status.Transport != "udp" {
		t.Errorf("expected Transport udp, got %s", status.Transport)
	}
	if !status.Active {
		t.Error("expected Active=true")
	}
}

func TestGetStatus_Nonexistent(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	mgr := NewUAManager(logger)

	status, ok := mgr.GetStatus("nonexistent")
	if ok {
		t.Fatal("GetStatus should return false for nonexistent node")
	}
	if status.NodeID != "" {
		t.Errorf("expected zero status, got NodeID=%s", status.NodeID)
	}
}

func TestCreateAndDestroy_NoGoroutineLeak(t *testing.T) {
	defer goleak.VerifyNone(t,
		goleak.IgnoreAnyFunction("internal/poll.runtime_pollWait"),
	)

	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	mgr := NewUAManager(logger)

	cfg := defaultTestConfig()
	if err := mgr.CreateUA("node-1", cfg); err != nil {
		t.Fatalf("CreateUA should succeed: %v", err)
	}

	if err := mgr.DestroyUA("node-1"); err != nil {
		t.Fatalf("DestroyUA should succeed: %v", err)
	}

	time.Sleep(100 * time.Millisecond)
}

func TestDestroyAll_NoGoroutineLeak(t *testing.T) {
	defer goleak.VerifyNone(t,
		goleak.IgnoreAnyFunction("internal/poll.runtime_pollWait"),
	)

	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	mgr := NewUAManager(logger)

	cfg := defaultTestConfig()
	for _, id := range []string{"node-1", "node-2", "node-3"} {
		if err := mgr.CreateUA(id, cfg); err != nil {
			t.Fatalf("CreateUA(%s) should succeed: %v", id, err)
		}
	}

	mgr.DestroyAll()
	time.Sleep(100 * time.Millisecond)
}

func TestGetDiago_Existing(t *testing.T) {
	defer goleak.VerifyNone(t,
		goleak.IgnoreAnyFunction("internal/poll.runtime_pollWait"),
	)

	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	mgr := NewUAManager(logger)
	defer func() {
		mgr.DestroyAll()
		time.Sleep(100 * time.Millisecond)
	}()

	cfg := defaultTestConfig()
	if err := mgr.CreateUA("node-1", cfg); err != nil {
		t.Fatalf("CreateUA should succeed: %v", err)
	}

	dg, err := mgr.GetDiago("node-1")
	if err != nil {
		t.Fatalf("GetDiago should succeed: %v", err)
	}
	if dg == nil {
		t.Fatal("GetDiago should return non-nil *diago.Diago")
	}
}

func TestGetDiago_Nonexistent(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	mgr := NewUAManager(logger)

	_, err := mgr.GetDiago("nonexistent")
	if err == nil {
		t.Fatal("GetDiago with nonexistent nodeID should return error")
	}
}

func TestGetDiago_Functional(t *testing.T) {
	defer goleak.VerifyNone(t,
		goleak.IgnoreAnyFunction("internal/poll.runtime_pollWait"),
	)

	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))
	mgr := NewUAManager(logger)
	defer func() {
		mgr.DestroyAll()
		time.Sleep(100 * time.Millisecond)
	}()

	cfg := defaultTestConfig()
	if err := mgr.CreateUA("node-1", cfg); err != nil {
		t.Fatalf("CreateUA(node-1) should succeed: %v", err)
	}
	if err := mgr.CreateUA("node-2", cfg); err != nil {
		t.Fatalf("CreateUA(node-2) should succeed: %v", err)
	}

	dg1, err := mgr.GetDiago("node-1")
	if err != nil {
		t.Fatalf("GetDiago(node-1) should succeed: %v", err)
	}
	dg2, err := mgr.GetDiago("node-2")
	if err != nil {
		t.Fatalf("GetDiago(node-2) should succeed: %v", err)
	}

	if dg1 == nil || dg2 == nil {
		t.Fatal("both GetDiago calls should return non-nil")
	}
	if dg1 == dg2 {
		t.Fatal("GetDiago should return distinct instances per node")
	}
}
