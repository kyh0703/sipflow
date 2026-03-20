package engine

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"sipflow/internal/pkg/eventhandler"
	"sipflow/internal/scenario"
)

// Engine는 시나리오 실행 엔진
type Engine struct {
	ctx        context.Context
	repo       *scenario.Repository
	emitter    EventEmitter
	im         *InstanceManager
	executor   *Executor
	mu         sync.Mutex
	running    bool
	scenarioID string
	cancelFunc context.CancelFunc
	runDone    chan struct{}
	terminal   scenarioTerminalState
	wg         sync.WaitGroup
}

type scenarioTerminalState string

const (
	terminalStateRunning scenarioTerminalState = "running"
	terminalStateStopped scenarioTerminalState = "stopped"
	terminalStateFailed  scenarioTerminalState = "failed"
)

// NewEngine는 새로운 Engine을 생성한다
func NewEngine(repo *scenario.Repository) *Engine {
	return &Engine{
		repo:    repo,
		emitter: nil, // SetContext에서 자동 설정
		im:      NewInstanceManager(),
	}
}

// SetContext는 Wails runtime context를 설정하고 WailsEventEmitter를 자동 생성한다
func (e *Engine) SetContext(ctx context.Context) {
	e.ctx = ctx
	e.emitter = &WailsEventEmitter{ctx: ctx}
}

// SetEventEmitter는 테스트 등에서 커스텀 EventEmitter를 주입할 수 있도록 한다
func (e *Engine) SetEventEmitter(emitter EventEmitter) {
	e.emitter = emitter
}

// StartScenario는 시나리오 실행을 시작한다
func (e *Engine) StartScenario(scenarioID string) error {
	e.mu.Lock()
	if e.running {
		e.mu.Unlock()
		return errors.New("scenario already running")
	}
	e.running = true
	e.mu.Unlock()

	scn, err := e.repo.LoadScenario(scenarioID)
	if err != nil {
		e.mu.Lock()
		e.running = false
		e.mu.Unlock()
		return err
	}

	graph, err := ParseScenario(scn.FlowData)
	if err != nil {
		e.cleanupOnError()
		return err
	}

	if err := e.im.CreateInstances(graph); err != nil {
		e.cleanupOnError()
		return err
	}

	parentCtx := context.Background()
	if e.ctx != nil {
		parentCtx = e.ctx
	}
	execCtx, cancel := context.WithCancel(parentCtx)

	e.mu.Lock()
	e.scenarioID = scenarioID
	e.cancelFunc = cancel
	e.runDone = make(chan struct{})
	e.terminal = terminalStateRunning
	e.mu.Unlock()

	if err := e.im.StartServing(execCtx); err != nil {
		cancel()
		e.cleanupOnError()
		return err
	}

	registerLoops := make([]struct {
		instanceID string
		errCh      <-chan error
	}, 0, len(graph.Instances))
	hasRegistrations := false

	for instanceID, chain := range graph.Instances {
		if !chain.Config.Register {
			continue
		}

		hasRegistrations = true
		e.emitActionLog("", instanceID, fmt.Sprintf("Registering DN %s", chain.Config.DN), "info")

		keepAlive := len(chain.StartNodes) > 0
		regErrCh, err := e.im.StartRegistration(execCtx, instanceID, keepAlive)
		if err != nil {
			cancel()
			e.cleanupOnError()
			return fmt.Errorf("instance %s register failed: %w", instanceID, err)
		}

		e.emitActionLog("", instanceID, fmt.Sprintf("Registered DN %s", chain.Config.DN), "info")
		if regErrCh != nil {
			registerLoops = append(registerLoops, struct {
				instanceID string
				errCh      <-chan error
			}{
				instanceID: instanceID,
				errCh:      regErrCh,
			})
		}
	}

	e.emitScenarioStarted(scenarioID)
	e.executor = NewExecutor(e, e.im)

	errCh := make(chan error, len(graph.Instances))
	hasStartNodes := false

	for instanceID, chain := range graph.Instances {
		if len(chain.StartNodes) == 0 {
			continue
		}

		hasStartNodes = true
		e.wg.Add(1)
		go func(id string, ch *InstanceChain) {
			defer e.wg.Done()
			for _, startNode := range ch.StartNodes {
				if err := e.executor.ExecuteChain(execCtx, id, startNode); err != nil {
					e.markTerminalState(terminalStateFailed)
					errCh <- fmt.Errorf("instance %s: %w", id, err)
					cancel()
					return
				}
			}
		}(instanceID, chain)
	}

	for _, regLoop := range registerLoops {
		go func(instanceID string, regErrCh <-chan error) {
			for err := range regErrCh {
				if err == nil {
					continue
				}
				e.markTerminalState(terminalStateFailed)
				errCh <- fmt.Errorf("instance %s register loop: %w", instanceID, err)
				cancel()
				return
			}
		}(regLoop.instanceID, regLoop.errCh)
	}

	go func() {
		var finalErr error

		switch {
		case hasStartNodes:
			e.wg.Wait()
		case hasRegistrations:
			<-execCtx.Done()
		}

		cancel()
		e.cleanup()

		e.mu.Lock()
		currentScenarioID := e.scenarioID
		terminalState := e.terminal
		runDone := e.runDone
		e.running = false
		e.scenarioID = ""
		e.cancelFunc = nil
		e.runDone = nil
		e.terminal = ""
		e.mu.Unlock()

		select {
		case err := <-errCh:
			finalErr = err
		default:
		}

		switch terminalState {
		case terminalStateFailed:
			if finalErr != nil {
				e.emitScenarioFailed(finalErr.Error())
			} else {
				e.emitScenarioFailed("scenario failed")
			}
		case terminalStateStopped:
			e.emitScenarioStopped()
		default:
			e.emitScenarioCompleted(currentScenarioID)
		}

		if runDone != nil {
			close(runDone)
		}
	}()

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
	runDone := e.runDone
	e.terminal = terminalStateStopped
	e.mu.Unlock()

	if cancelFunc != nil {
		cancelFunc()
	}

	select {
	case <-runDone:
	case <-time.After(10 * time.Second):
		e.emitActionLog("", "", "StopScenario timeout - forced shutdown", "warn")
	}

	return nil
}

// cleanupOnError는 에러 발생 시 리소스를 정리한다
func (e *Engine) cleanupOnError() {
	e.im.Cleanup()
	e.mu.Lock()
	e.running = false
	e.scenarioID = ""
	e.cancelFunc = nil
	e.runDone = nil
	e.terminal = ""
	e.mu.Unlock()
}

// cleanup은 시나리오 실행 종료 후 모든 리소스를 정리한다
func (e *Engine) cleanup() {
	e.emitActionLog("", "", "Starting cleanup", "info")

	if e.executor != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		e.executor.sessions.HangupAll(ctx)
		cancel()
		e.executor.sessions.CloseAll()
	}

	e.im.Cleanup()
	e.emitActionLog("", "", "Cleanup completed", "info")

	e.mu.Lock()
	e.executor = nil
	e.mu.Unlock()
}

func (e *Engine) markTerminalState(next scenarioTerminalState) {
	e.mu.Lock()
	defer e.mu.Unlock()

	switch e.terminal {
	case terminalStateStopped, terminalStateFailed:
		return
	case terminalStateRunning:
		e.terminal = next
	}
}

// emitSIPEvent는 SessionStore의 SIP 이벤트 버스를 통해 이벤트를 전달한다
func (e *Engine) emitSIPEvent(instanceID string, eventType eventhandler.SIPEventType, callID string) {
	e.mu.Lock()
	ex := e.executor
	e.mu.Unlock()
	if ex != nil {
		ex.sessions.EmitSIPEvent(instanceID, eventType, callID)
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
