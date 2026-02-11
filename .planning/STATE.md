# SIPFLOW Project State

## 현재 상태
- **마일스톤**: v1.1 — 미디어 + DTMF
- **페이즈**: Phase 6 — Codec Configuration
- **상태**: `roadmap-ready`
- **최근 활동**: 2026-02-11 — 로드맵 생성 완료

## 프로젝트 참조

### 핵심 가치
- **시각적 시나리오 빌더**: XYFlow 기반 노드 에디터로 SIP 콜플로우를 직관적으로 구성
- **Command/Event 아키텍처**: SIP 액션(Command)과 이벤트 대기(Event)를 노드로 분리하여 정확한 콜플로우 모델링
- **N개 SIP 인스턴스**: 다중 SIP UA를 동시에 생성하여 복잡한 시나리오 검증
- **이중 모드**: 로컬 시뮬레이션 모드 + 실제 SIP 트래픽 생성 모드

### 현재 초점 (v1.1)
SIP 통화 시나리오에 미디어 재생, DTMF 송수신, 코덱 선택 기능을 추가하여 실제 SIP 미디어 워크플로우를 시뮬레이션/실행할 수 있도록 확장

## 현재 위치

### 페이즈: 6 - Codec Configuration
**목표:** 사용자가 SIP 인스턴스별 코덱을 선택하고 우선순위를 설정하여 SDP 협상에 반영할 수 있다

**요구사항:** CODEC-01

**계획:** 0/? 완료

**상태:** 대기 중

**진행:**
```
Phase 6: [░░░░░░░░░░] 0%
```

### 전체 마일스톤 진행
```
v1.1 Roadmap: [░░░░░░░░░░] 0/4 페이즈 (0%)

✓ Phase 6: Codec Configuration [대기]
✓ Phase 7: Media Playback [대기]
✓ Phase 8: DTMF Send & Receive [대기]
✓ Phase 9: Integration & Polish [대기]
```

## 성능 지표

### v1.1 마일스톤
- **총 페이즈**: 4
- **완료된 페이즈**: 0
- **총 요구사항**: 9
- **완료된 요구사항**: 0
- **총 계획**: 미정
- **완료된 계획**: 0

### 프로젝트 전체
- **완료된 마일스톤**: 1 (v1.0)
- **진행 중 마일스톤**: 1 (v1.1)
- **총 페이즈 (v1.0+v1.1)**: 9 (5 완료 + 4 대기)
- **총 계획 (v1.0+v1.1)**: 22+ (22 완료 + 미정)

## 누적 컨텍스트

### 현재 페이즈 결정사항
없음 (Phase 6 시작 전)

### 할일 (TODO)
- [ ] Phase 6 계획 생성 (`/prp:plan-phase 6`)
- [ ] 코덱 선택 UI 설계
- [ ] diago MediaConfig API 통합 검증
- [ ] PCMU/PCMA SDP 협상 테스트

### 차단 요소
없음

### 완료된 마일스톤
- **v1.0 — MVP**: 시각적 시나리오 빌더 + 시뮬레이션 실행 (5 phases, 22 plans, 78 commits, 2026-02-11 완료)

## 세션 연속성
- **Last session:** 2026-02-11
- **Stopped at:** 로드맵 생성 완료 — v1.1 Phase 6~9 정의됨
- **Resume file:** None
- **다음 단계:** `/prp:plan-phase 6` — Codec Configuration 계획 생성

## 프로젝트 메모리

### 비즈니스 규칙
- Command 노드는 SIP 액션을 능동적으로 실행하는 노드
- Event 노드는 SIP 이벤트를 수동적으로 대기하는 노드
- 각 노드는 반드시 하나의 SIP 인스턴스에 할당되어야 함
- 시나리오 그래프는 DAG(방향 비순환 그래프) 형태

### 도메인 지식
- diago의 Diago 타입이 SIP UA 인스턴스의 엔트리포인트
- DialogSession 인터페이스가 통화 세션의 추상화
- diago DialogMedia API가 재생/녹음/DTMF를 모두 지원 (v0.27.0)
- Bridge 타입은 2자 통화만 지원, 코덱 transcoding 미지원
- SDP 협상 완료 후에만 dialog.Media() 호출 가능 (RTP 세션 초기화 순서)
- SIP/RTP는 표준적으로 8kHz mono G.711 사용 (PCMU=0, PCMA=8)
- RFC 2833 RTP telephone-event가 DTMF 표준 (In-band보다 신뢰성 높음)

### 기술적 제약
- Wails v2 Windows hot reload 불안정 (Linux에서 개발 권장)
- diago Hold/Unhold: 빈 SDP 처리 이슈 (#110)
- XYFlow stroke-dasharray 성능 문제 → SVG animateMotion 사용
- diago Bridge는 코덱 호환성 필수 (양측 공통 코덱 없으면 488 Not Acceptable)
- WAV 파일 포맷 불일치 시 재생 속도 왜곡 (8kHz mono PCM 필수)
- CGO 의존성 회피를 위해 Opus 코덱 제외 (v1.1)

### 의사결정 로그
- [2026-02-09] 프로젝트 초기화, MVP 범위 확정
- [2026-02-09] Command/Event 노드 모델 채택
- [2026-02-09] 시뮬레이션 + 실제 실행 이중 모드 결정
- [2026-02-09] Wails v2 + React + Vite 템플릿 채택 (01-01)
- [2026-02-09] internal/ 패키지 구조: engine, scenario, binding (01-01)
- [2026-02-09] Multiple Binding Structs 패턴 채택 (01-01)
- [2026-02-09] diago v0.27.0 SIP 라이브러리 채택 (01-01)
- [2026-02-09] Tailwind CSS v4 CSS 기반 설정 채택 (01-02)
- [2026-02-09] shadcn/ui new-york 스타일 채택 (01-02)
- [2026-02-09] useEffect + useState 바인딩 호출 패턴 (01-03)
- [2026-02-10] 프론트엔드 파일명 kebab-case 컨벤션 채택 (02-03)
- [2026-02-10] modernc.org/sqlite CGo-free SQLite 채택 (02-02)
- [2026-02-10] Wails models.ts에서 타입 import 패턴 (02-05)
- [2026-02-10] EventEmitter 인터페이스 패턴 채택 (03-01)
- [2026-02-10] SetContext 시 WailsEventEmitter 자동 설정 (03-01)
- [2026-02-10] 그래프 포인터 체인 구조 채택 (03-01)
- [2026-02-10] 기본 타임아웃 10초, 커스텀 지원 (03-01)
- [2026-02-10] Context 기반 UA 정리 패턴 채택 (03-02)
- [2026-02-10] 포트 순차 할당 +2 간격 (03-02)
- [2026-02-10] SessionStore로 dialog 생명주기 관리 (03-03)
- [2026-02-10] RINGING 이벤트 즉시 완료 (로컬 모드 단순화) (03-03)
- [2026-02-10] TIMEOUT 이벤트를 딜레이로 구현 (03-03)
- [2026-02-10] StartScenario 비동기 실행 패턴 (03-04)
- [2026-02-10] 인스턴스별 goroutine 실행 (03-04)
- [2026-02-10] 에러 채널로 실패 전파 (03-04)
- [2026-02-10] cleanup 순서: Hangup → Close → IM.Cleanup (03-04)
- [2026-02-10] StopScenario 10초 타임아웃 패턴 (03-04)
- [2026-02-10] Wails EventsOn/EventsOff store 통합 패턴 (03-05)
- [2026-02-10] Record<string, State> Zustand 패턴 (03-05)
- [2026-02-10] ActionLog 최대 500개 제한 (03-05)
- [2026-02-10] 실행 상태가 검증 오류보다 우선 (03-07)
- [2026-02-10] 로그 패널 auto-scroll + conditional rendering (03-07)
- [2026-02-11] Functional Options 패턴으로 emitActionLog 확장 (04-01)
- [2026-02-11] sipMessages 별도 배열로 필터링 최적화 (04-01)
- [2026-02-11] 컴포넌트 레벨 엣지 애니메이션 생명주기 관리 (04-01)
- [2026-02-11] AnimatedMessageEdge가 BranchEdge 대체 (04-02)
- [2026-02-11] useShallow로 Zustand 리렌더링 최적화 (04-02)
- [2026-02-11] Sonner toast로 alert() 전면 대체 (04-02)
- [2026-02-11] 스마트 자동 스크롤 isAtBottom 패턴 (04-02)
- [2026-02-11] SVG width/height 직접 설정 (viewBox 미사용) (04-03)
- [2026-02-11] 단일 인스턴스 시 리스트 fallback (04-03)
- [2026-02-11] Go nil 슬라이스 → 빈 슬라이스 초기화 패턴 (04-03)
- [2026-02-11] SVG animateMotion 기반 엣지 애니메이션 (04-02)
- [2026-02-11] 로그 레벨 필터링 UI (info/warning/error 토글) (04-02)
- [2026-02-11] Smart auto-scroll (isAtBottom 체크) (04-02)
- [2026-02-11] Sonner toast로 alert() 전면 교체 (04-02)
- [2026-02-11] next-themes 기반 다크모드 구현 (05-01)
- [2026-02-11] 3-way 순환 토글 (Light/Dark/System) (05-01)
- [2026-02-11] resolvedTheme으로 배경색 조건 분기 (05-01)
- [2026-02-11] scenarioID 추적을 Engine에 추가 (05-03)
- [2026-02-11] 2-instance TIMEOUT 체인 시뮬레이션 패턴 (05-03)
- [2026-02-11] shadcn/ui Button 컴포넌트 추가 (05-03)
- [2026-02-11] 2000ms debounce 자동 저장 (05-02)
- [2026-02-11] saveStatus와 isDirty 분리 관리 (05-02)
- [2026-02-11] Zustand subscribe 외부 모듈 스코프 호출 패턴 (05-02)
- [2026-02-11] onNodeDragStop에서 드래그 완료 후 저장 (05-02)
- [2026-02-11] v1.1 범위 확정: 미디어 재생 + DTMF (녹음 연기)
- [2026-02-11] Opus 코덱 제외 (CGO 의존성 회피, v1.2+로 연기)
- [2026-02-11] PCMU를 기본 fallback 코덱으로 채택 (협상 실패 방지)
- [2026-02-11] 8kHz mono PCM WAV 포맷 검증 필수 (재생 속도 왜곡 방지)
- [2026-02-11] RFC 2833 DTMF 기본값 (In-band 제외)

## 결정사항 누적

| Plan | 결정 | 이유 | 영향 범위 |
|------|------|------|-----------|
| 01-01 | Wails v2 + React + Vite | 공식 템플릿, TypeScript 우선, HMR | 전체 프로젝트 |
| 01-01 | internal/ 3계층 구조 | 도메인 분리 (engine, scenario, binding) | 백엔드 아키텍처 |
| 01-01 | Multiple Binding Structs | 관심사 분리, 독립적 바인딩 추가 가능 | Frontend-Backend 통신 |
| 01-01 | diago v0.27.0 채택 | sipgo 기반, DialogSession 추상화 | SIP 엔진 구현 |
| 01-02 | Tailwind CSS v4 (CSS 기반) | JS config 불필요, @tailwindcss/vite | 프론트엔드 스타일링 |
| 01-02 | shadcn/ui new-york 스타일 | neutral base color, CSS variables | UI 컴포넌트 |
| 01-03 | useEffect 마운트 패턴 | 비동기 바인딩 호출 + 에러 처리 | 프론트엔드 패턴 |
| 02-02 | modernc.org/sqlite | CGo-free, 크로스 컴파일 용이 | 데이터 저장 |
| 02-03 | kebab-case 파일명 | 사용자 선호, 일관성 | 프론트엔드 파일 구조 |
| 02-05 | Wails models.ts 타입 import | Wails 자동 생성 타입 활용 | Frontend-Backend 타입 |
| 03-01 | EventEmitter 인터페이스 패턴 | 테스트 가능한 이벤트 시스템, 의존성 역전 | Engine 이벤트 발행 |
| 03-01 | SetContext 시 WailsEventEmitter 자동 설정 | 프로덕션 코드 간소화, 테스트는 SetEventEmitter로 재정의 | Engine 초기화 |
| 03-01 | 그래프 포인터 체인 구조 | SuccessNext/FailureNext로 O(1) 접근, DAG 구조 적합 | 시나리오 실행 |
| 03-01 | 기본 타임아웃 10초 | SIP 이벤트 대기 시 네트워크 지연 고려, 커스텀 가능 | Event 노드 실행 |
| 03-02 | Context 기반 UA 정리 | diago에 Close() 메서드 없음, context 취소로 리소스 정리 | UA 생명주기 관리 |
| 03-02 | 포트 순차 할당 +2 간격 | RTP 포트 충돌 방지, 디버깅 용이 | 로컬 모드 포트 할당 |
| 03-03 | SessionStore로 dialog 관리 | Command/Event 간 상태 공유, thread-safe 접근 | Executor 세션 관리 |
| 03-03 | RINGING 이벤트 즉시 완료 | 로컬 모드에서 MakeCall 성공 시 이미 180 경유 | Event 실행 단순화 |
| 03-03 | TIMEOUT을 딜레이로 구현 | 시나리오에서 의도적 대기 표현 | Event 노드 확장 |
| 03-04 | StartScenario 비동기 실행 | frontend 블로킹 없이 장기 실행 지원, 이벤트로 진행 추적 | 시나리오 실행 API |
| 03-04 | 인스턴스별 goroutine 실행 | 독립적 UA 병렬 실행, 성능 향상 | 실행 오케스트레이션 |
| 03-04 | 에러 채널로 실패 전파 | 하나의 인스턴스 실패 시 전체 중단, context 취소 | 에러 처리 |
| 03-04 | cleanup 순서 정의 | Hangup → Close → IM.Cleanup (SIP 프로토콜 준수) | 리소스 정리 |
| 03-04 | StopScenario 10초 타임아웃 | goroutine 미응답 시 강제 종료, 앱 shutdown 블로킹 방지 | graceful shutdown |
| 03-05 | Wails EventsOn/EventsOff 패턴 | Zustand store에서 직접 이벤트 구독, startListening/stopListening 생명주기 관리 | 이벤트 통합 |
| 03-05 | Record<string, State> 사용 | Map 대신 plain object로 Zustand immutable 업데이트 용이 | 상태 관리 |
| 03-05 | ActionLog 최대 500개 유지 | 메모리 누수 방지, 장기 실행 안정성 | 로그 관리 |
| 03-07 | 실행 상태 우선순위 | 노드 실행 상태가 검증 오류보다 우선 표시, 사용자에게 현재 진행 상황 명확히 전달 | 노드 시각화 |
| 03-07 | 로그 패널 조건부 렌더링 | idle 상태에서 숨김, 실행 시만 표시로 화면 공간 절약 | UI 레이아웃 |
| 03-07 | ExecutionToolbar 헤더 통합 | 실행 컨트롤과 저장 버튼을 우측에 그룹화 | UI 구성 |
| 04-01 | Functional Options 패턴 | ActionLogOption으로 sipMessage 선택적 추가, 기존 호출 하위 호환 | 이벤트 시스템 확장 |
| 04-01 | sipMessages 별도 배열 | actionLogs에서 필터링하지 않고 삽입 시 분리, O(1) 접근 | 성능 최적화 |
| 04-01 | 컴포넌트 레벨 애니메이션 생명주기 | setTimeout으로 엣지 애니메이션 정리, store는 순수 상태만 관리 | 관심사 분리 |
| 04-01 | Call-ID 빈 문자열 | diago 인터페이스 제약으로 빈 문자열 사용, 코멘트로 문서화 | 기술적 한계 수용 |
| 04-02 | AnimatedMessageEdge가 BranchEdge 대체 | 애니메이션 로직을 포함한 상위 호환 컴포넌트로 교체 | 모든 branch 엣지에 자동 애니메이션 |
| 04-02 | Canvas에서 엣지 애니메이션 트리거 | actionLogs 변화 감지하여 sipMessage 시 애니메이션 생성 | 중앙화된 애니메이션 관리 |
| 04-02 | 로그 레벨 필터링 UI | info/warning/error 토글 버튼으로 빠른 필터링 | 장기 실행 시 로그 디버깅 용이 |
| 04-02 | Smart auto-scroll | isAtBottom 체크로 사용자 스크롤 존중 | UX 개선, 수동 리뷰 방해 없음 |
| 04-02 | Sonner toast 전면 도입 | alert() 제거, 비차단 알림으로 전환 | 일관된 알림 UX |
| 05-01 | next-themes 기반 다크모드 | 이미 설치된 next-themes 활용, Sonner와 테마 컨텍스트 공유 | 전역 테마 컨텍스트로 모든 컴포넌트 자동 연동 |
| 05-01 | 3-way 순환 토글 패턴 | Light → Dark → System 순환, 단일 버튼으로 직관적 UX | 공간 효율, 빠른 전환 |
| 05-01 | resolvedTheme으로 배경색 조건 분기 | ReactFlow Background 컴포넌트 API 제약 대응 | System 모드에서도 정확한 테마 반영 |
| 05-03 | scenarioID 추적을 Engine에 추가 | scenario:completed 이벤트에 scenarioID 포함하여 여러 시나리오 실행 추적 가능 | 이벤트 추적 개선, 다중 실행 지원 준비 |
| 05-03 | 2-instance TIMEOUT 체인 시뮬레이션 | diago localhost 포트 충돌로 실제 SIP 통화 불가, TIMEOUT 이벤트로 병렬 실행 검증 | 테스트 전략, 엔진 파이프라인 검증 |
| 05-02 | 2000ms debounce 자동 저장 | 사용자 결정 1-2초 범위 → 2000ms 채택 | 데이터 손실 방지, UX 향상 |
| 05-02 | saveStatus와 isDirty 분리 | isDirty는 변경 추적, saveStatus는 저장 상태 (saved/modified/saving) | UI에서 저장 프로세스 명확 표시 |
| 05-02 | position 변경 분리 | onNodesChange에서 position 변경 무시, onNodeDragStop에서 isDirty 설정 | 드래그 중 저장 방지 |
| 05-02 | 인라인 debounce 구현 | lodash/use-debounce 없이 인라인 구현, cancel 메서드 포함 | 외부 의존성 불필요, 수동 저장 시 pending save 취소 |

## 차단 요소 / 우려사항

### 해결됨
- ~~diago dependency go mod tidy 제거 이슈~~ → 블랭크 임포트로 해결 (01-01)
- ~~Wails 바인딩 타입 import 에러~~ → models.ts namespace import로 해결 (02-05)

### 현재
- libwebkit 시스템 의존성 누락 (Linux 프로덕션 빌드 시 필요, 개발은 가능)
- npm audit moderate 취약점 (프로덕션 전 수정 필요)
- diago Call-ID 미지원 (04-01에서 문서화, 향후 diago 업데이트 대기)
