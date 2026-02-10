---
phase: "03"
plan: "02"
title: "인스턴스 매니저 + 로컬 모드 포트 할당"
subsystem: "sip-engine"
tags: ["diago", "sip", "instance-management", "port-allocation"]
requires: ["03-01"]
provides: ["instance-manager", "ua-lifecycle", "port-allocation"]
affects: ["03-03", "03-04"]
tech-stack:
  added: []
  patterns: ["context-cancellation", "sequential-port-allocation", "goroutine-lifecycle"]
key-files:
  created:
    - internal/engine/instance_manager.go
    - internal/engine/instance_manager_test.go
  modified:
    - internal/engine/engine.go
decisions:
  - title: "Context 기반 UA 정리"
    rationale: "diago.Diago에 Close() 메서드가 없어 context 취소로 Serve 중지 및 리소스 정리"
    alternatives: ["명시적 Close API 대기"]
    impact: "Cleanup이 context 취소만으로 동작, 간결한 리소스 관리"
  - title: "포트 순차 할당 (+2 간격)"
    rationale: "RTP 포트와 충돌 방지, 명확한 포트 패턴 (5060, 5062, 5064...)"
    alternatives: ["Ephemeral 포트 (0)", "랜덤 포트"]
    impact: "디버깅 용이, 로컬 모드에서 예측 가능한 포트"
  - title: "테스트 포트 15060+ 사용"
    rationale: "시스템 SIP 서비스와 충돌 방지"
    alternatives: ["5060 직접 사용"]
    impact: "테스트 안정성 향상"
metrics:
  duration: "20분"
  completed: "2026-02-10"
---

# Phase 03 Plan 02: 인스턴스 매니저 + 로컬 모드 포트 할당 Summary

## 한 줄 요약
diago SIP UA를 127.0.0.1에 바인딩하여 생성/관리하는 InstanceManager 구현, 포트 순차 할당 (+2 간격) 및 context 기반 정리

## 목표 달성 여부
✅ **완료** - 모든 must_haves 구현 및 검증 완료

## 구현 내용

### Task 1: InstanceManager 타입 및 UA 생성 로직
**구현:**
- `ManagedInstance` 구조체: diago UA, 포트, incoming 채널, cancel 함수 관리
- `InstanceManager` 구조체: 인스턴스 맵, 포트 할당 상태 (basePort, nextPort, maxRetries)
- `CreateInstances()`: ExecutionGraph의 모든 인스턴스에 대해 diago UA 생성
  - 포트 할당 실패 시 이미 생성된 인스턴스 정리 (rollback)
  - `sipgo.NewUA()` → `diago.NewDiago()` → ManagedInstance 생성
- `allocatePort()`: 127.0.0.1:{port}에 UDP bind 테스트로 사용 가능 여부 확인
  - 성공 시 nextPort += 2 업데이트
  - 충돌 시 +2하여 재시도 (최대 10회)
- `StartServing()`: 모든 인스턴스에 대해 goroutine으로 `dg.Serve(ctx, handler)` 시작
  - handler: incoming dialog를 `incomingCh`로 전달
  - 각 인스턴스에 cancelable context 할당
- `GetInstance()`: instanceID로 ManagedInstance 조회
- `Cleanup()`: 모든 cancel() 호출 → Serve 중지, 맵 초기화, nextPort 리셋
- `Reset()`: Cleanup 호출 후 상태 초기화

**핵심 발견:**
- diago.Diago에 Close() 메서드 없음 → context 취소로 Serve 중지 및 정리
- diago.NewDiago()는 에러 반환하지 않음 (research와 달리 단일 반환값)

**파일:**
- `internal/engine/instance_manager.go` (183 lines)

**커밋:** `1948fcd`

---

### Task 2: InstanceManager를 Engine에 연결
**구현:**
- Engine 구조체에 `im *InstanceManager` 필드 추가
- `NewEngine()` 생성자에서 `im: NewInstanceManager()` 초기화
- `GetInstanceManager()` 메서드 추가 - InstanceManager 접근자

**영향:**
- Engine이 UA 인스턴스 생명주기 관리 가능
- 후속 plan (03-03, 03-04)에서 `e.GetInstanceManager()`로 인스턴스 접근

**파일:**
- `internal/engine/engine.go` (+7 lines)

**커밋:** `270a41e`

---

### Task 3: 포트 할당 단위 테스트
**구현:**
- `TestAllocatePort_Sequential`: 포트 순차 할당 (15060, 15062, 15064) 검증
- `TestCreateInstances_Basic`: 2개 인스턴스 생성, 다른 포트 할당 확인
  - UA, incomingCh, Config 필드 검증
  - 버퍼 크기 (cap=1) 확인
- `TestCleanup`: Cleanup 후 instances 맵 비어있음, nextPort 리셋 확인
- `TestGetInstance_NotFound`: 존재하지 않는 인스턴스 조회 시 에러 검증
- `TestReset`: Reset 후 상태 초기화 확인

**테스트 전략:**
- 테스트 포트 15060+ 사용 (시스템 SIP 서비스 충돌 방지)
- 실제 diago UA 생성 (mock 없음) → 통합 테스트 수준

**검증 결과:**
```
=== RUN   TestAllocatePort_Sequential
--- PASS: TestAllocatePort_Sequential (0.00s)
=== RUN   TestCreateInstances_Basic
--- PASS: TestCreateInstances_Basic (0.00s)
=== RUN   TestCleanup
--- PASS: TestCleanup (0.00s)
=== RUN   TestGetInstance_NotFound
--- PASS: TestGetInstance_NotFound (0.00s)
=== RUN   TestReset
--- PASS: TestReset (0.00s)
PASS
ok  	sipflow/internal/engine	0.003s
```

**파일:**
- `internal/engine/instance_manager_test.go` (229 lines)

**커밋:** `c692c95`

---

## 검증 결과

### 빌드 검증
- ✅ `go build ./internal/engine/...` 성공 (모든 태스크 후)

### 단위 테스트
- ✅ TestAllocatePort_Sequential: 포트 순차 할당 동작 확인
- ✅ TestCreateInstances_Basic: 2개 인스턴스 생성, 다른 포트 할당
- ✅ TestCleanup: 정리 후 맵 초기화, nextPort 리셋
- ✅ TestGetInstance_NotFound: 에러 처리
- ✅ TestReset: 상태 초기화
- ✅ 전체 engine 패키지 테스트 10개 모두 통과 (기존 graph_test 포함)

### 성공 기준 충족
- ✅ diago UA 인스턴스를 127.0.0.1에 바인딩하여 생성하는 InstanceManager
- ✅ 포트 순차 할당 (5060, 5062, 5064...) 및 충돌 재시도
- ✅ Incoming 이벤트를 채널로 전달하는 메커니즘 (incomingCh)
- ✅ 모든 UA 리소스를 정리하는 Cleanup (context 취소 기반)

---

## 기술 결정 상세

### 1. Context 기반 UA 정리
**결정:** diago.Diago에 Close() 메서드가 없어 context 취소로 Serve 중지 및 리소스 정리

**근거:**
- diago research 문서에서 Close() API 언급했으나 실제 API에 존재하지 않음
- `dg.Serve(ctx, handler)`는 context가 취소되면 자동으로 종료
- sipgo 내부적으로 context 취소 시 모든 리소스 정리 수행

**트레이드오프:**
- 장점: 간결한 정리 로직, Go의 표준 context 패턴
- 단점: 명시적 Close()보다 정리 완료 시점 파악 어려움

**영향:**
- Cleanup()이 cancel() 호출만으로 동작
- Serve가 goroutine에서 실행되므로 즉시 종료 보장 어려움 (향후 WaitGroup 추가 가능)

---

### 2. 포트 순차 할당 (+2 간격)
**결정:** 5060부터 시작하여 +2 간격으로 포트 할당 (5060, 5062, 5064...)

**근거:**
- RTP 포트가 일반적으로 짝수 포트 사용 (diago/media 패키지가 자동 할당)
- +2 간격으로 SIP 포트와 RTP 포트 충돌 방지
- 로컬 모드에서 디버깅 시 포트 패턴 예측 가능

**대안:**
- Ephemeral 포트 (BindPort: 0): OS가 자동 할당, 포트 번호 예측 불가
- 랜덤 포트: 충돌 확률 낮지만 디버깅 어려움

**영향:**
- 로컬 모드에서 UA 간 통신 시 포트 번호로 인스턴스 식별 가능
- 최대 인스턴스 수: 약 30,000개 (5060~65535, +2 간격)

---

### 3. 포트 충돌 재시도 전략
**결정:** 포트 사용 불가 시 +2하여 최대 10회 재시도

**구현:**
```go
for i := 0; i < im.maxRetries; i++ {
    port := im.nextPort + (i * 2)
    conn, err := net.ListenPacket("udp", fmt.Sprintf("127.0.0.1:%d", port))
    if err == nil {
        conn.Close()
        im.nextPort = port + 2
        return port, nil
    }
}
```

**근거:**
- 5060 포트가 시스템 SIP 서비스에서 사용 중일 수 있음
- 자동 재시도로 사용자 개입 없이 해결

**트레이드오프:**
- 장점: 견고성, 사용자 친화적
- 단점: 10회 실패 시 에러 (드물지만 가능)

---

### 4. Incoming 채널 버퍼 크기 1
**결정:** `incomingCh` 채널을 버퍼 크기 1로 생성

**근거:**
- 각 인스턴스는 동시에 하나의 incoming call만 대기 (단순 시나리오 가정)
- 버퍼 1로 handler가 블록되지 않도록 보장
- 초과 incoming call은 버퍼 풀 시 handler 블록 (향후 큐 구현 가능)

**영향:**
- Phase 03 범위에서는 충분
- Phase 04 이후 다중 incoming 지원 시 버퍼 크기 조정 필요

---

## Deviations from Plan

없음 - 계획이 작성된 대로 정확히 실행됨.

**계획 대비 조정:**
- diago.NewDiago()가 에러 반환하지 않음 (research 문서와 달리 단일 반환값)
  - 실제 API 확인 후 에러 처리 로직 제거
- diago.Diago.Close() 메서드 없음
  - context 취소로 정리하도록 변경

---

## Task Commits

| Task | Description | Commit | Files |
|------|-------------|--------|-------|
| 1 | InstanceManager 타입 및 UA 생성 로직 | 1948fcd | internal/engine/instance_manager.go |
| 2 | InstanceManager를 Engine에 연결 | 270a41e | internal/engine/engine.go |
| 3 | 포트 할당 단위 테스트 | c692c95 | internal/engine/instance_manager_test.go |

---

## 남은 작업 (다음 Plan)

### Plan 03-03: Command 노드 실행기
- MakeCall, Answer, Release 커맨드 실행
- diago.Invite(), Answer(), Hangup() API 사용
- Dialog 세션 관리 (AllSessions 맵)

### Plan 03-04: Event 노드 실행기
- INCOMING, DISCONNECTED 이벤트 대기
- incomingCh 채널 소비
- context.WithTimeout으로 타임아웃 처리

### Plan 03-05: 시나리오 실행 오케스트레이션
- StartScenario/StopScenario 구현
- 인스턴스별 goroutine 실행
- 실패 분기 처리 및 cleanup

---

## 기술 부채 및 개선 사항

### 현재 제약사항
1. **Serve 종료 대기 없음**
   - Cleanup()이 cancel() 호출만 수행
   - goroutine이 즉시 종료된다고 보장할 수 없음
   - **개선**: WaitGroup으로 Serve goroutine 종료 대기

2. **Incoming 채널 오버플로우 처리 없음**
   - 버퍼 풀 시 handler 블록
   - **개선**: 버퍼 크기 증가 또는 큐 구조 도입

3. **포트 재사용 없음**
   - Cleanup 후 nextPort만 리셋, 이전 포트 재사용하지 않음
   - **개선**: 사용 가능한 포트 풀 관리

### 향후 개선 아이디어
1. **포트 할당 전략 설정**
   - 환경 변수로 basePort, maxRetries 설정
   - Ephemeral 포트 모드 지원

2. **인스턴스 상태 추적**
   - ManagedInstance에 상태 필드 추가 (idle, serving, stopped)
   - GetInstances() 메서드로 모든 인스턴스 상태 조회

3. **메트릭 수집**
   - 할당된 포트 목록
   - 인스턴스 생성 실패 횟수
   - 평균 포트 할당 시간

---

## 학습 내용

### diago API 실제 사용
1. **NewDiago()는 에러 반환하지 않음**
   - research 문서와 달리 `dg := diago.NewDiago(ua, opts...)` 형태
   - 설정 오류는 Serve 시점에 발생

2. **Close() 메서드 없음**
   - context 취소로 모든 리소스 정리
   - Go 표준 패턴 (net/http.Server와 유사)

3. **Serve는 blocking**
   - 반드시 goroutine에서 실행
   - context 취소 시 자동 종료

### 포트 바인딩 테스트 패턴
- `net.ListenPacket("udp", "127.0.0.1:{port}")`로 사용 가능 여부 확인
- 즉시 Close()하여 diago가 바인딩할 수 있도록 해제
- 테스트 환경에서는 높은 포트 번호 사용 (15060+)

---

## Self-Check: PASSED

**생성된 파일 검증:**
- ✅ internal/engine/instance_manager.go
- ✅ internal/engine/instance_manager_test.go

**수정된 파일 검증:**
- ✅ internal/engine/engine.go

**커밋 검증:**
- ✅ 1948fcd: feat(03-02): implement InstanceManager with diago UA lifecycle
- ✅ 270a41e: feat(03-02): integrate InstanceManager into Engine
- ✅ c692c95: test(03-02): add unit tests for InstanceManager port allocation

**빌드 검증:**
- ✅ go build ./internal/engine/... 성공

**테스트 검증:**
- ✅ 10개 테스트 모두 통과
