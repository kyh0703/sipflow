package eventhandler

import "time"

type SIPEventType string

const (
	SIPEventIncoming     SIPEventType = "INCOMING"
	SIPEventDisconnected SIPEventType = "DISCONNECTED"
	SIPEventRinging      SIPEventType = "RINGING"
	SIPEventTimeout      SIPEventType = "TIMEOUT"
	SIPEventDTMFReceived SIPEventType = "DTMFReceived"
	SIPEventHeld         SIPEventType = "HELD"
	SIPEventRetrieved    SIPEventType = "RETRIEVED"
	SIPEventTransferred  SIPEventType = "TRANSFERRED"
	SIPEventNotify       SIPEventType = "NOTIFY"
)

type Event struct {
	Type          SIPEventType
	SIPCallID     string
	InstanceID    string
	LogicalCallID string
	StatusCode    int
}

type Subject interface {
	ID() string
	Register(Listener)
	Deregister(Listener)
	Notify(Event)
	ListenerCount() int
	CreatedAt() time.Time
}

type Listener interface {
	ID() string
	Close()
	OnEvent(Event)
}
