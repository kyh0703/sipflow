package eventhandler

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
)

var ErrTimeout = errors.New("event handler timeout")

type DoneFn func()
type EventFunc func(ctx context.Context, event Event, done DoneFn) error

type Handler struct {
	id       string
	timer    *time.Timer
	bus      chan Event
	doneCh   chan struct{}
	isDone   bool
	handlers map[SIPEventType]EventFunc
}

func NewHandler(bufferSize int) *Handler {
	if bufferSize <= 0 {
		bufferSize = 8
	}

	return &Handler{
		id:       uuid.NewString(),
		bus:      make(chan Event, bufferSize),
		doneCh:   make(chan struct{}, 1),
		handlers: make(map[SIPEventType]EventFunc),
	}
}

func (h *Handler) ID() string {
	return h.id
}

func (h *Handler) SetTimer(duration time.Duration) {
	if h.timer == nil {
		h.timer = time.NewTimer(duration)
		return
	}

	if !h.timer.Stop() {
		select {
		case <-h.timer.C:
		default:
		}
	}
	h.timer.Reset(duration)
}

func (h *Handler) SetHandler(eventType SIPEventType, handler EventFunc) {
	h.handlers[eventType] = handler
}

func (h *Handler) OnEvent(event Event) {
	select {
	case h.bus <- event:
	default:
	}
}

func (h *Handler) Close() {
	if h.timer != nil {
		h.timer.Stop()
	}
}

func (h *Handler) done() {
	if h.isDone {
		return
	}
	h.isDone = true
	select {
	case h.doneCh <- struct{}{}:
	default:
	}
}

func (h *Handler) ProcEvent(ctx context.Context, event Event) error {
	if h.isDone {
		return nil
	}

	handler, exists := h.handlers[event.Type]
	if !exists || handler == nil {
		return nil
	}

	return handler(ctx, event, h.done)
}

func (h *Handler) Poll(ctx context.Context) error {
	if h.timer == nil {
		h.timer = time.NewTimer(2 * time.Second)
	}

	for {
		select {
		case <-h.doneCh:
			return nil
		case <-ctx.Done():
			return ctx.Err()
		case <-h.timer.C:
			return ErrTimeout
		case event := <-h.bus:
			if err := h.ProcEvent(ctx, event); err != nil {
				return err
			}
		}
	}
}
