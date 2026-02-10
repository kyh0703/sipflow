package engine

import (
	"context"
	"errors"
	"fmt"
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

// StartScenario는 시나리오 실행을 시작한다
func (e *Engine) StartScenario(scenarioID string) error {
	// 1. 동시 실행 방지
	e.mu.Lock()
	if e.running {
		e.mu.Unlock()
		return errors.New("scenario already running")
	}
	e.running = true
	e.mu.Unlock()

	// 2. 시나리오 로드
	scenario, err := e.repo.LoadScenario(scenarioID)
	if err != nil {
		e.mu.Lock()
		e.running = false
		e.mu.Unlock()
		return err
	}

	// 3. 그래프 파싱
	graph, err := ParseScenario(scenario.FlowData)
	if err != nil {
		e.cleanupOnError()
		return err
	}

	// 4. 인스턴스 생성
	if err := e.im.CreateInstances(graph); err != nil {
		e.cleanupOnError()
		return err
	}

	// 6. 실행 context 생성
	execCtx, cancel := context.WithCancel(context.Background())
	e.mu.Lock()
	e.cancelFunc = cancel
	e.mu.Unlock()

	// 5. 인스턴스 Serve 시작
	if err := e.im.StartServing(execCtx); err != nil {
		cancel()
		e.cleanupOnError()
		return err
	}

	// 7. 시나리오 시작 이벤트 발행
	e.emitScenarioStarted(scenarioID)

	// 8. Executor 생성
	executor := NewExecutor(e, e.im)

	// 9. 각 인스턴스마다 goroutine 실행
	errCh := make(chan error, len(graph.Instances))

	for instanceID, chain := range graph.Instances {
		e.wg.Add(1)
		go func(id string, ch *InstanceChain) {
			defer e.wg.Done()
			for _, startNode := range ch.StartNodes {
				if err := executor.ExecuteChain(execCtx, id, startNode); err != nil {
					errCh <- fmt.Errorf("instance %s: %w", id, err)
					cancel() // 전체 중단
					return
				}
			}
		}(instanceID, chain)
	}

	// 10. 별도 goroutine에서 완료 대기 및 최종 처리
	go func() {
		e.wg.Wait()
		// cleanup
		e.cleanup(executor)

		// 결과 판단
		select {
		case err := <-errCh:
			e.emitScenarioFailed(err.Error())
		default:
			e.emitScenarioCompleted()
		}

		e.mu.Lock()
		e.running = false
		e.cancelFunc = nil
		e.mu.Unlock()
	}()

	// 11. StartScenario는 goroutine 시작 후 즉시 nil 반환 (비동기 실행)
	return nil
}

// StopScenario는 실행 중인 시나리오를 중지한다 (후속 계획에서 구현)
func (e *Engine) StopScenario() error {
	return errors.New("not implemented")
}

// cleanupOnError는 에러 발생 시 리소스를 정리한다
func (e *Engine) cleanupOnError() {
	e.im.Cleanup()
	e.mu.Lock()
	e.running = false
	e.mu.Unlock()
}

// cleanup은 시나리오 실행 종료 시 모든 리소스를 정리한다
func (e *Engine) cleanup(executor *Executor) {
	// 액션 로그 발행: "Starting cleanup"
	e.emitActionLog("", "", "Starting cleanup", "info")

	// HangupAll - 5초 타임아웃으로 모든 활성 세션 Hangup
	ctx := context.Background()
	executor.sessions.HangupAll(ctx)

	// CloseAll - 모든 세션 Close
	executor.sessions.CloseAll()

	// InstanceManager cleanup - 모든 UA 정리
	e.im.Cleanup()

	// 액션 로그 발행: "Cleanup completed"
	e.emitActionLog("", "", "Cleanup completed", "info")
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
