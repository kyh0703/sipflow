package sip

import (
	"bytes"
	"context"
	"log/slog"
	"sync"
	"testing"
)

func TestSIPTraceHandler_CallbackReceivesEntry(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})

	var received SIPTraceEntry
	var called bool
	callback := func(entry SIPTraceEntry) {
		received = entry
		called = true
	}

	handler := NewSIPTraceHandler(inner, callback)
	logger := slog.New(handler)

	logger.Info("SIP INVITE sent", "node", "node-1")

	if !called {
		t.Fatal("callback should have been called")
	}
	if received.Message != "SIP INVITE sent" {
		t.Errorf("expected message 'SIP INVITE sent', got '%s'", received.Message)
	}
	if received.Level != "INFO" {
		t.Errorf("expected level INFO, got %s", received.Level)
	}
	if received.NodeID != "node-1" {
		t.Errorf("expected NodeID node-1, got %s", received.NodeID)
	}
	if received.Time.IsZero() {
		t.Error("expected non-zero time")
	}
}

func TestSIPTraceHandler_InnerHandlerReceivesRecord(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})

	callback := func(entry SIPTraceEntry) {}

	handler := NewSIPTraceHandler(inner, callback)
	logger := slog.New(handler)

	logger.Info("test message")

	if buf.Len() == 0 {
		t.Error("inner handler should have received the log record")
	}
}

func TestSIPTraceHandler_NodeIDFromAttr(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})

	var received SIPTraceEntry
	callback := func(entry SIPTraceEntry) {
		received = entry
	}

	handler := NewSIPTraceHandler(inner, callback)
	logger := slog.New(handler)

	logger.Info("SIP 200 OK", "node", "node-42", "method", "INVITE")

	if received.NodeID != "node-42" {
		t.Errorf("expected NodeID node-42, got %s", received.NodeID)
	}
}

func TestSIPTraceHandler_NoNodeAttr(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})

	var received SIPTraceEntry
	callback := func(entry SIPTraceEntry) {
		received = entry
	}

	handler := NewSIPTraceHandler(inner, callback)
	logger := slog.New(handler)

	logger.Info("generic log")

	if received.NodeID != "" {
		t.Errorf("expected empty NodeID, got %s", received.NodeID)
	}
}

func TestSIPTraceHandler_Enabled(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelWarn})

	callback := func(entry SIPTraceEntry) {}

	handler := NewSIPTraceHandler(inner, callback)

	if handler.Enabled(context.Background(), slog.LevelDebug) {
		t.Error("should not be enabled for debug when inner is warn level")
	}
	if !handler.Enabled(context.Background(), slog.LevelError) {
		t.Error("should be enabled for error when inner is warn level")
	}
}

func TestSIPTraceHandler_WithAttrs(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})

	var mu sync.Mutex
	var entries []SIPTraceEntry
	callback := func(entry SIPTraceEntry) {
		mu.Lock()
		entries = append(entries, entry)
		mu.Unlock()
	}

	handler := NewSIPTraceHandler(inner, callback)
	newHandler := handler.WithAttrs([]slog.Attr{slog.String("component", "sip")})

	logger := slog.New(newHandler)
	logger.Info("test with attrs")

	mu.Lock()
	defer mu.Unlock()
	if len(entries) == 0 {
		t.Fatal("callback should have been called")
	}
}

func TestSIPTraceHandler_WithGroup(t *testing.T) {
	var buf bytes.Buffer
	inner := slog.NewTextHandler(&buf, &slog.HandlerOptions{Level: slog.LevelDebug})

	var called bool
	callback := func(entry SIPTraceEntry) {
		called = true
	}

	handler := NewSIPTraceHandler(inner, callback)
	newHandler := handler.WithGroup("sip")

	logger := slog.New(newHandler)
	logger.Info("test with group")

	if !called {
		t.Fatal("callback should have been called")
	}
}
