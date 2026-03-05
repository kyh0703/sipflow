package entity

import "time"

// GraphNode는 실행 그래프 노드
type GraphNode struct {
	ID             string
	Type           string // command|event
	InstanceID     string
	Command        string         // MakeCall|Answer|Release|PlayAudio|SendDTMF|Hold|Retrieve|BlindTransfer (command 노드 전용)
	TargetURI      string         // MakeCall 대상 URI (command 노드 전용)
	FilePath       string         // PlayAudio WAV 파일 경로 (command 노드 전용)
	Digits         string         // SendDTMF 전송할 DTMF digit 문자열 (command 노드 전용)
	IntervalMs     float64        // SendDTMF digit 간 전송 간격 ms (command 노드 전용)
	Event          string         // INCOMING|DISCONNECTED|RINGING|TIMEOUT|DTMFReceived|HELD|RETRIEVED|TRANSFERRED (event 노드 전용)
	ExpectedDigit  string         // DTMFReceived 대기할 특정 digit (event 노드 전용)
	Timeout        time.Duration  // 타임아웃 (기본 10초)
	TransferTarget string         // 레거시 (Phase 10 대비)
	TargetUser     string         // BlindTransfer 대상 user 부분 (Phase 11)
	TargetHost     string         // BlindTransfer 대상 host:port (Phase 11)
	SuccessNext    *GraphNode     // 성공 분기 다음 노드
	FailureNext    *GraphNode     // 실패 분기 다음 노드
	Data           map[string]any // 원본 노드 데이터 (executePlayAudio에서 필요)
}
