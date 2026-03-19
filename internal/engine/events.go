package engine

import (
	"context"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// 이벤트 이름 상수
const (
	EventNodeState  = "scenario:node-state"
	EventActionLog  = "scenario:action-log"
	EventStarted    = "scenario:started"
	EventCompleted  = "scenario:completed"
	EventFailed     = "scenario:failed"
	EventStopped    = "scenario:stopped"
)

// 노드 상태 상수
const (
	NodeStatePending   = "pending"
	NodeStateRunning   = "running"
	NodeStateCompleted = "completed"
	NodeStateFailed    = "failed"
)

// EventEmitter는 이벤트 발행을 추상화한다.
// 프로덕션에서는 WailsEventEmitter, 테스트에서는 TestEventEmitter를 사용한다.
type EventEmitter interface {
	Emit(eventName string, data map[string]interface{})
}

// WailsEventEmitter는 프로덕션용 이벤트 발행기
type WailsEventEmitter struct {
	ctx context.Context
}

func (we *WailsEventEmitter) Emit(eventName string, data map[string]interface{}) {
	if we.ctx != nil {
		runtime.EventsEmit(we.ctx, eventName, data)
	}
}

// emitNodeState는 노드 상태 변경 이벤트를 발행한다
func (e *Engine) emitNodeState(nodeID, prevState, newState string) {
	if e.emitter != nil {
		e.emitter.Emit(EventNodeState, map[string]interface{}{
			"nodeId":        nodeID,
			"previousState": prevState,
			"newState":      newState,
			"timestamp":     time.Now().UnixMilli(),
		})
	}
}

// ActionLogOption은 emitActionLog의 functional option이다
type ActionLogOption func(data map[string]interface{})

// WithCallID는 logical call ID를 액션 로그 최상위 필드와 SIP 메시지 상세 정보에 기록한다.
func WithCallID(callID string) ActionLogOption {
	return func(data map[string]interface{}) {
		if callID == "" {
			return
		}

		data["callId"] = callID

		if sipMessage, ok := data["sipMessage"].(map[string]interface{}); ok {
			existing, _ := sipMessage["callId"].(string)
			if existing == "" {
				sipMessage["callId"] = callID
			}
		}
	}
}

// WithSIPMessage는 SIP 메시지 상세 정보를 포함하는 옵션이다.
// note는 선택적 파라미터로, SDP 방향(sendonly/recvonly/sendrecv 등) 등 추가 메모를 전달한다.
func WithSIPMessage(direction, method string, responseCode int, callID, from, to string, note ...string) ActionLogOption {
	return func(data map[string]interface{}) {
		msg := map[string]interface{}{
			"direction":    direction,
			"method":       method,
			"responseCode": responseCode,
			"callId":       callID,
			"from":         from,
			"to":           to,
		}
		if len(note) > 0 && note[0] != "" {
			msg["note"] = note[0]
		}
		data["sipMessage"] = msg
	}
}

// emitActionLog는 액션 로그 이벤트를 발행한다
func (e *Engine) emitActionLog(nodeID, instanceID, message, level string, opts ...ActionLogOption) {
	if e.emitter != nil {
		data := map[string]interface{}{
			"nodeId":     nodeID,
			"instanceId": instanceID,
			"message":    message,
			"level":      level,
			"timestamp":  time.Now().UnixMilli(),
		}

		// opts 적용
		for _, opt := range opts {
			opt(data)
		}

		e.emitter.Emit(EventActionLog, data)
	}
}

// emitScenarioStarted는 시나리오 시작 이벤트를 발행한다
func (e *Engine) emitScenarioStarted(scenarioID string) {
	if e.emitter != nil {
		e.emitter.Emit(EventStarted, map[string]interface{}{
			"scenarioId": scenarioID,
			"timestamp":  time.Now().UnixMilli(),
		})
	}
}

// emitScenarioCompleted는 시나리오 완료 이벤트를 발행한다
func (e *Engine) emitScenarioCompleted(scenarioID string) {
	if e.emitter != nil {
		e.emitter.Emit(EventCompleted, map[string]interface{}{
			"scenarioId": scenarioID,
			"timestamp":  time.Now().UnixMilli(),
		})
	}
}

// emitScenarioFailed는 시나리오 실패 이벤트를 발행한다
func (e *Engine) emitScenarioFailed(errMsg string) {
	if e.emitter != nil {
		e.emitter.Emit(EventFailed, map[string]interface{}{
			"error":     errMsg,
			"timestamp": time.Now().UnixMilli(),
		})
	}
}

// emitScenarioStopped는 시나리오 중지 이벤트를 발행한다
func (e *Engine) emitScenarioStopped() {
	if e.emitter != nil {
		e.emitter.Emit(EventStopped, map[string]interface{}{
			"timestamp": time.Now().UnixMilli(),
		})
	}
}
