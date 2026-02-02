package sip

import (
	"context"
	"log/slog"
	"time"
)

// SIPTraceEntry represents a captured SIP trace log entry.
type SIPTraceEntry struct {
	Time    time.Time
	Level   string
	Message string
	NodeID  string
}

// SIPTraceHandler wraps slog.Handler and calls a callback with each log record.
type SIPTraceHandler struct {
	inner    slog.Handler
	callback func(SIPTraceEntry)
}

// NewSIPTraceHandler creates a new SIPTraceHandler.
func NewSIPTraceHandler(inner slog.Handler, callback func(SIPTraceEntry)) *SIPTraceHandler {
	return &SIPTraceHandler{
		inner:    inner,
		callback: callback,
	}
}

// Enabled delegates to inner handler.
func (h *SIPTraceHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return false
}

// Handle delegates to inner handler (stub - does not call callback yet).
func (h *SIPTraceHandler) Handle(ctx context.Context, record slog.Record) error {
	return nil
}

// WithAttrs delegates to inner handler.
func (h *SIPTraceHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return h
}

// WithGroup delegates to inner handler.
func (h *SIPTraceHandler) WithGroup(name string) slog.Handler {
	return h
}
