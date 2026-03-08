package engine

import (
	"testing"

	"sipflow/internal/pkg/eventhandler"
)

func TestSupportedCommands(t *testing.T) {
	commands := SupportedCommands()

	expected := []string{
		string(SIPCommandMakeCall),
		string(SIPCommandAnswer),
		string(SIPCommandRelease),
		string(SIPCommandPlayAudio),
		string(SIPCommandSendDTMF),
		string(SIPCommandHold),
		string(SIPCommandRetrieve),
		string(SIPCommandBlindTransfer),
		string(SIPCommandMuteTransfer),
	}

	if len(commands) != len(expected) {
		t.Fatalf("expected %d commands, got %d", len(expected), len(commands))
	}
	for i, command := range expected {
		if commands[i] != command {
			t.Fatalf("expected command[%d]=%s, got %s", i, command, commands[i])
		}
	}
}

func TestSupportedEvents(t *testing.T) {
	events := SupportedEvents()

	expected := []string{
		string(eventhandler.SIPEventIncoming),
		string(eventhandler.SIPEventDisconnected),
		string(eventhandler.SIPEventRinging),
		string(eventhandler.SIPEventTimeout),
		string(eventhandler.SIPEventDTMFReceived),
		string(eventhandler.SIPEventHeld),
		string(eventhandler.SIPEventRetrieved),
		string(eventhandler.SIPEventTransferred),
	}

	if len(events) != len(expected) {
		t.Fatalf("expected %d events, got %d", len(expected), len(events))
	}
	for i, event := range expected {
		if events[i] != event {
			t.Fatalf("expected event[%d]=%s, got %s", i, event, events[i])
		}
	}
}
