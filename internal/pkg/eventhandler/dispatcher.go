package eventhandler

import (
	"sync"
	"time"
)

type Dispatcher struct {
	id        string
	mu        sync.RWMutex
	listeners map[string]Listener
	createdAt time.Time
}

func NewDispatcher(id string) Subject {
	return &Dispatcher{
		id:        id,
		listeners: make(map[string]Listener),
		createdAt: time.Now(),
	}
}

func (d *Dispatcher) ID() string {
	return d.id
}

func (d *Dispatcher) Register(listener Listener) {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.listeners[listener.ID()] = listener
}

func (d *Dispatcher) Deregister(listener Listener) {
	d.mu.Lock()
	defer d.mu.Unlock()
	delete(d.listeners, listener.ID())
}

func (d *Dispatcher) Notify(event Event) {
	d.mu.RLock()
	listeners := make([]Listener, 0, len(d.listeners))
	for _, listener := range d.listeners {
		listeners = append(listeners, listener)
	}
	d.mu.RUnlock()

	for _, listener := range listeners {
		listener.OnEvent(event)
	}
}

func (d *Dispatcher) ListenerCount() int {
	d.mu.RLock()
	defer d.mu.RUnlock()
	return len(d.listeners)
}

func (d *Dispatcher) CreatedAt() time.Time {
	return d.createdAt
}
