package engine

import (
	"context"
	"errors"
	"sync"

	"sipflow/internal/scenario"
)

// Engine은 시나리오 실행 엔진
type Engine struct {
	ctx        context.Context
	repo       *scenario.Repository
	emitter    EventEmitter
	im         *InstanceManager
	mu         sync.Mutex
	running    bool
	cancelFunc context.CancelFunc
	wg         sync.WaitGroup
}

// NewEngine은 새로운 Engine을 생성한다
func NewEngine(repo *scenario.Repository) *Engine {
	return &Engine{
		repo:    repo,
		emitter: nil, // SetContext 시 자동 설정
		im:      NewInstanceManager(),
	}
}

// SetContext는 Wails runtime context를 설정하고 WailsEventEmitter를 자동 생성한다
func (e *Engine) SetContext(ctx context.Context) {
	e.ctx = ctx
	e.emitter = &WailsEventEmitter{ctx: ctx}
}

// SetEventEmitter는 테스트 등 외부에서 커스텀 EventEmitter를 주입할 수 있도록 한다
func (e *Engine) SetEventEmitter(emitter EventEmitter) {
	e.emitter = emitter
}

// StartScenario는 시나리오 실행을 시작한다 (후속 계획에서 구현)
func (e *Engine) StartScenario(scenarioID string) error {
	return errors.New("not implemented")
}

// StopScenario는 실행 중인 시나리오를 중지한다 (후속 계획에서 구현)
func (e *Engine) StopScenario() error {
	return errors.New("not implemented")
}

// IsRunning은 시나리오가 실행 중인지 확인한다
func (e *Engine) IsRunning() bool {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.running
}

// GetInstanceManager는 InstanceManager를 반환한다
func (e *Engine) GetInstanceManager() *InstanceManager {
	return e.im
}
