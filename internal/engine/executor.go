package engine

import (
	"context"
	"sync"
	"time"

	"github.com/emiago/diago"
)

// SessionStore는 활성 SIP 세션을 thread-safe하게 관리한다
type SessionStore struct {
	mu             sync.RWMutex
	dialogs        map[string]diago.DialogSession          // instanceID -> dialog session
	serverSessions map[string]*diago.DialogServerSession   // instanceID -> incoming server session
}

// NewSessionStore는 새로운 SessionStore를 생성한다
func NewSessionStore() *SessionStore {
	return &SessionStore{
		dialogs:        make(map[string]diago.DialogSession),
		serverSessions: make(map[string]*diago.DialogServerSession),
	}
}

// StoreDialog는 dialog session을 저장한다
func (ss *SessionStore) StoreDialog(key string, dialog diago.DialogSession) {
	ss.mu.Lock()
	defer ss.mu.Unlock()
	ss.dialogs[key] = dialog
}

// GetDialog는 dialog session을 조회한다
func (ss *SessionStore) GetDialog(key string) (diago.DialogSession, bool) {
	ss.mu.RLock()
	defer ss.mu.RUnlock()
	dialog, exists := ss.dialogs[key]
	return dialog, exists
}

// StoreServerSession은 incoming server session을 저장한다
func (ss *SessionStore) StoreServerSession(instanceID string, session *diago.DialogServerSession) {
	ss.mu.Lock()
	defer ss.mu.Unlock()
	ss.serverSessions[instanceID] = session
}

// GetServerSession은 incoming server session을 조회한다
func (ss *SessionStore) GetServerSession(instanceID string) (*diago.DialogServerSession, bool) {
	ss.mu.RLock()
	defer ss.mu.RUnlock()
	session, exists := ss.serverSessions[instanceID]
	return session, exists
}

// HangupAll은 모든 활성 dialog의 Hangup을 호출한다
func (ss *SessionStore) HangupAll(ctx context.Context) {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	// 5초 타임아웃 context
	hangupCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	for _, dialog := range ss.dialogs {
		_ = dialog.Hangup(hangupCtx)
	}
}

// CloseAll은 모든 dialog의 Close를 호출한다
func (ss *SessionStore) CloseAll() {
	ss.mu.Lock()
	defer ss.mu.Unlock()

	for _, dialog := range ss.dialogs {
		_ = dialog.Close()
	}
}

// Executor는 시나리오 그래프의 노드를 실행한다
type Executor struct {
	engine   *Engine           // 이벤트 발행용 부모 참조
	im       *InstanceManager  // UA 조회용
	sessions *SessionStore     // 활성 세션 저장소
}

// NewExecutor는 새로운 Executor를 생성한다
func NewExecutor(engine *Engine, im *InstanceManager) *Executor {
	return &Executor{
		engine:   engine,
		im:       im,
		sessions: NewSessionStore(),
	}
}
