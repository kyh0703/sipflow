package engine

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"sipflow/internal/scenario"
)

// Engine은 시나리오 실행 엔진
type Engine struct {
	ctx         context.Context
	repo        *scenario.Repository
	emitter     EventEmitter
	im          *InstanceManager
	executor    *Executor
	mu          sync.Mutex
	running     bool
	scenarioID  string
	cancelFunc  context.CancelFunc
	wg          sync.WaitGroup
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
	e.scenarioID = scenarioID
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

	// 8. Executor 생성 (필드로 승격하여 emitSIPEvent에서 접근 가능)
	e.executor = NewExecutor(e, e.im)

	// 9. 각 인스턴스마다 goroutine 실행
	errCh := make(chan error, len(graph.Instances))

	for instanceID, chain := range graph.Instances {
		e.wg.Add(1)
		go func(id string, ch *InstanceChain) {
			defer e.wg.Done()
			for _, startNode := range ch.StartNodes {
				if err := e.executor.ExecuteChain(execCtx, id, startNode); err != nil {
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
		e.cleanup()

		// 결과 판단
		e.mu.Lock()
		currentScenarioID := e.scenarioID
		e.mu.Unlock()

		select {
		case err := <-errCh:
			e.emitScenarioFailed(err.Error())
		default:
			e.emitScenarioCompleted(currentScenarioID)
		}

		e.mu.Lock()
		e.running = false
		e.scenarioID = ""
		e.cancelFunc = nil
		e.mu.Unlock()
	}()

	// 11. StartScenario는 goroutine 시작 후 즉시 nil 반환 (비동기 실행)
	return nil
}

// StopScenario는 실행 중인 시나리오를 중지한다
func (e *Engine) StopScenario() error {
	e.mu.Lock()
	if !e.running {
		e.mu.Unlock()
		return errors.New("no running scenario")
	}
	cancelFunc := e.cancelFunc
	e.mu.Unlock()

	// Context 취소
	if cancelFunc != nil {
		cancelFunc()
	}

	// 타임아웃으로 goroutine 종료 대기 (최대 10초)
	done := make(chan struct{})
	go func() {
		e.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		// 정상 종료
	case <-time.After(10 * time.Second):
		// 강제 종료 (로그 경고)
		e.emitActionLog("", "", "StopScenario timeout - forced shutdown", "warn")
	}

	// 이벤트 발행
	e.emitScenarioStopped()

	// 상태 리셋
	e.mu.Lock()
	e.running = false
	e.scenarioID = ""
	e.cancelFunc = nil
	e.mu.Unlock()

	return nil
}

// cleanupOnError는 에러 발생 시 리소스를 정리한다
func (e *Engine) cleanupOnError() {
	e.im.Cleanup()
	e.mu.Lock()
	e.running = false
	e.scenarioID = ""
	e.mu.Unlock()
}

// cleanup은 시나리오 실행 종료 시 모든 리소스를 정리한다
func (e *Engine) cleanup() {
	// 액션 로그 발행: "Starting cleanup"
	e.emitActionLog("", "", "Starting cleanup", "info")

	// HangupAll - 5초 타임아웃으로 모든 활성 세션 Hangup
	ctx := context.Background()
	e.executor.sessions.HangupAll(ctx)

	// CloseAll - 모든 세션 Close
	e.executor.sessions.CloseAll()

	// InstanceManager cleanup - 모든 UA 정리
	e.im.Cleanup()

	// 액션 로그 발행: "Cleanup completed"
	e.emitActionLog("", "", "Cleanup completed", "info")

	// executor 참조 해제 (GC 허용)
	e.mu.Lock()
	e.executor = nil
	e.mu.Unlock()
}

// emitSIPEvent는 SessionStore의 SIP 이벤트 버스에 이벤트를 전달한다
func (e *Engine) emitSIPEvent(instanceID, eventType string) {
	e.mu.Lock()
	ex := e.executor
	e.mu.Unlock()
	if ex != nil {
		ex.sessions.emitSIPEvent(instanceID, eventType)
	}
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
