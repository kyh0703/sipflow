# Phase 03 Context: SIP 엔진 — Go 백엔드 핵심

> diago 기반 SIP 인스턴스 관리 및 시나리오 실행 엔진

## 논의된 영역

1. [시나리오 실행 모델](#1-시나리오-실행-모델)
2. [시뮬레이션 vs 실제 모드](#2-시뮬레이션-vs-실제-모드)
3. [실행 이벤트 스트림](#3-실행-이벤트-스트림)

---

## 1. 시나리오 실행 모델

### 결정사항

**그래프 순회 방식:** 인스턴스별 독립 goroutine
- 각 SIP Instance가 자신의 노드 체인을 독립 goroutine으로 실행
- Event 노드에서는 diago 콜백/채널로 SIP 이벤트 대기
- 인스턴스 간 동기화는 SIP 프로토콜 자체가 담당 (A가 MakeCall → B에서 Incoming 발생)
- context.Context 기반 취소/타임아웃 관리

**실패 처리:**
- Command 실패 시 failure 분기가 연결되어 있으면 → failure 경로로 실행
- failure 분기가 없으면 → **전체 시나리오 중단** + 모든 인스턴스 cleanup + 에러 이벤트 발행
- cleanup: 모든 활성 SIP 세션 Hangup → diago UA 종료

**Event 노드 타임아웃:**
- 기본 타임아웃: **10초**
- 노드별 오버라이드: Event 노드 속성 패널에서 타임아웃 값 설정 가능
- 타임아웃 발생 시: failure 분기로 진행 (failure 분기 없으면 전체 시나리오 중단)

**시나리오 완료 판단:**
- 모든 인스턴스의 마지막 노드 실행 완료
- **+ 모든 SIP 세션 정리(cleanup) 확인**
- cleanup 완료 후 시나리오 상태를 "completed" 또는 "failed"로 최종 결정

---

## 2. 시뮬레이션 vs 실제 모드

### 결정사항

**"시뮬레이션 모드" = 로컬 SIP 모드:**
- 실제 diago SIP UA를 `127.0.0.1`에 바인딩하여 UA끼리 실제 SIP 통신
- Mock/가짜 이벤트가 아닌 **실제 SIP 시그널링**이 로컬에서 발생
- 외부 PBX/SIP 서버 불필요
- 엔진 코어 로직은 로컬/실제 모드 동일 — 트랜스포트 설정만 다름

**포트 할당:**
- 로컬 모드: 엔진이 자동으로 포트 순차 할당 (5060, 5062, 5064...)
- 각 SIP Instance UA에 고유 포트 바인딩
- 포트 충돌 시 자동으로 다음 포트 시도

**실패 시나리오 테스트:**
- Response 노드로 실패 유발 가능
  - 예: Instance B에서 `Incoming → Response(486)` → Instance A의 MakeCall이 failure 분기로
- 로컬 SIP에서도 성공/실패 양쪽 경로 모두 테스트 가능

**Phase 03 범위:**
- **로컬 모드만** 구현
- 실제 모드(외부 PBX 연결)는 Phase 5 이후로 미룸
- 툴바에 모드 토글 UI 배치 (로컬/실제), Phase 03에서는 로컬만 활성화

**이벤트 표시 수준:**
- 추상화된 이벤트만 표시 ("MakeCall 시작", "Incoming 수신", "Answer 완료")
- 실제 SIP 메시지 내용(INVITE sip:... 등)은 Phase 4 로그 패널에서

**모드 전환 UX:**
- 툴바에 토글 스위치 (시뮬레이션/실제)
- 실행 버튼은 하나 (현재 모드에 따라 동작)

---

## 3. 실행 이벤트 스트림

### 결정사항

**전달 메커니즘:**
- Wails `runtime.EventsEmit(ctx, eventName, data)` 사용
- Frontend에서 `runtime.EventsOn(eventName, callback)` 으로 수신
- 내부 IPC 채널 (WebSocket 아님), 오버헤드 최소

**이벤트 내용:** 노드 상태 + 액션 로그
- **노드 상태 변경 이벤트**: nodeId, 이전 상태, 새 상태 (pending → running → completed/failed)
- **액션 로그 이벤트**: 타임스탬프, nodeId, instanceId, 메시지 (e.g. "MakeCall to sip:100@127.0.0.1:5062")
- **시나리오 상태 이벤트**: 시나리오 전체 상태 (running → completed/failed/stopped)

**제어 API:** Start + Stop
- `StartScenario(scenarioId string) error` — 시나리오 로드 + 실행 시작
- `StopScenario() error` — 강제 중단 + cleanup
- Pause/Resume는 Phase 4에서 추가

**상태 조회:**
- 이벤트 스트림만으로 프론트엔드가 상태 구성 (별도 폴링 API 불필요)
- 프론트엔드 Zustand store에서 이벤트를 수신하여 실행 상태 관리

**실행 이력:**
- Phase 03에서는 **메모리만** (실행 중 상태)
- 앱 재시작 시 이력 사라짐
- DB 저장은 향후 Phase에서 추가

---

## 미뤄진 아이디어

| 아이디어 | 출처 | 비고 |
|----------|------|------|
| 실제 모드(외부 PBX 연결) | Phase 03 논의 | Phase 5 이후, 엔진 코어는 동일하므로 트랜스포트만 변경 |
| Pause/Resume 제어 | Phase 03 논의 | Phase 4 (실행 모니터)에서 구현 |
| 실행 이력 DB 저장 | Phase 03 논의 | 향후 Phase에서 SQLite에 실행 결과 저장 |
| 실제 SIP 메시지 로그 | Phase 03 논의 | Phase 4 로그 패널에서 상세 SIP 메시지 표시 |
| Mock 모드(SIP 없이 그래프만) | Phase 03 논의 | 로컬 SIP 모드로 충분, 필요 시 향후 추가 |

---

## 다음 단계

이 CONTEXT.md를 기반으로:
1. `/prp:plan-phase 3` — Phase 3의 상세 실행 계획(PLAN.md) 생성
