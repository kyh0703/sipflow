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
// It delegates all standard slog.Handler methods to the inner handler while
// additionally invoking a callback function with a SIPTraceEntry for each record.
type SIPTraceHandler struct {
	inner    slog.Handler
	callback func(SIPTraceEntry)
}

// NewSIPTraceHandler creates a new SIPTraceHandler that wraps the inner handler
// and calls the callback for each log record.
func NewSIPTraceHandler(inner slog.Handler, callback func(SIPTraceEntry)) *SIPTraceHandler {
	return &SIPTraceHandler{
		inner:    inner,
		callback: callback,
	}
}

// Enabled delegates to inner handler.
func (h *SIPTraceHandler) Enabled(ctx context.Context, level slog.Level) bool {
	return h.inner.Enabled(ctx, level)
}

// Handle calls the inner handler and additionally invokes the callback with
// a SIPTraceEntry extracted from the record.
func (h *SIPTraceHandler) Handle(ctx context.Context, record slog.Record) error {
	// Extract NodeID from "node" attribute
	var nodeID string
	record.Attrs(func(attr slog.Attr) bool {
		if attr.Key == "node" {
			nodeID = attr.Value.String()
			return false
		}
		return true
	})

	// Build trace entry
	entry := SIPTraceEntry{
		Time:    record.Time,
		Level:   record.Level.String(),
		Message: record.Message,
		NodeID:  nodeID,
	}

	// Call callback
	if h.callback != nil {
		h.callback(entry)
	}

	// Delegate to inner handler
	return h.inner.Handle(ctx, record)
}

// WithAttrs returns a new SIPTraceHandler with the inner handler updated.
func (h *SIPTraceHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	return &SIPTraceHandler{
		inner:    h.inner.WithAttrs(attrs),
		callback: h.callback,
	}
}

// WithGroup returns a new SIPTraceHandler with the inner handler updated.
func (h *SIPTraceHandler) WithGroup(name string) slog.Handler {
	return &SIPTraceHandler{
		inner:    h.inner.WithGroup(name),
		callback: h.callback,
	}
}
