package engine

import "sipflow/internal/pkg/eventhandler"

type SIPCommandType string

const (
	SIPCommandMakeCall      SIPCommandType = "MakeCall"
	SIPCommandAnswer        SIPCommandType = "Answer"
	SIPCommandRelease       SIPCommandType = "Release"
	SIPCommandPlayAudio     SIPCommandType = "PlayAudio"
	SIPCommandSendDTMF      SIPCommandType = "SendDTMF"
	SIPCommandHold          SIPCommandType = "Hold"
	SIPCommandRetrieve      SIPCommandType = "Retrieve"
	SIPCommandBlindTransfer SIPCommandType = "BlindTransfer"
	SIPCommandMuteTransfer  SIPCommandType = "MuteTransfer"
)

var supportedCommands = []string{
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

var supportedEvents = []string{
	string(eventhandler.SIPEventIncoming),
	string(eventhandler.SIPEventDisconnected),
	string(eventhandler.SIPEventRinging),
	string(eventhandler.SIPEventTimeout),
	string(eventhandler.SIPEventDTMFReceived),
	string(eventhandler.SIPEventHeld),
	string(eventhandler.SIPEventRetrieved),
	string(eventhandler.SIPEventTransferred),
}

func SupportedCommands() []string {
	return append([]string(nil), supportedCommands...)
}

func SupportedEvents() []string {
	return append([]string(nil), supportedEvents...)
}
