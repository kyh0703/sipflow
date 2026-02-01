package handler

import (
	"context"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// EventEmitter handles event emission to frontend with handshake protocol
type EventEmitter struct {
	ctx           context.Context
	frontendReady bool
	readyChan     chan struct{}
	readyOnce     sync.Once
}

// NewEventEmitter creates a new EventEmitter instance
func NewEventEmitter() *EventEmitter {
	return &EventEmitter{
		readyChan: make(chan struct{}),
	}
}

// SetContext sets the Wails context for event emission
func (e *EventEmitter) SetContext(ctx context.Context) {
	e.ctx = ctx
}

// OnStartup is called during Wails app startup
// It registers the frontend:ready event listener and completes the handshake
func (e *EventEmitter) OnStartup(ctx context.Context) {
	e.SetContext(ctx)

	// Register listener for frontend:ready event
	runtime.EventsOn(ctx, "frontend:ready", func(optionalData ...interface{}) {
		e.frontendReady = true

		// Emit backend:ready to complete handshake
		runtime.EventsEmit(ctx, "backend:ready")

		// Signal any waiting goroutines (safe against multiple calls from hot-reload)
		e.readyOnce.Do(func() {
			close(e.readyChan)
		})
	})
}

// WaitForFrontend blocks until frontend signals ready or timeout occurs
func (e *EventEmitter) WaitForFrontend(timeout time.Duration) error {
	if e.frontendReady {
		return nil
	}

	select {
	case <-e.readyChan:
		return nil
	case <-time.After(timeout):
		return context.DeadlineExceeded
	}
}

// Emit sends an event to the frontend if frontend is ready
func (e *EventEmitter) Emit(eventName string, data ...interface{}) {
	if !e.frontendReady {
		return
	}
	runtime.EventsEmit(e.ctx, eventName, data...)
}

// EmitSafe sends an event to the frontend with a 100us delay for rapid events
func (e *EventEmitter) EmitSafe(eventName string, data ...interface{}) {
	if !e.frontendReady {
		return
	}
	runtime.EventsEmit(e.ctx, eventName, data...)
	time.Sleep(100 * time.Microsecond)
}
