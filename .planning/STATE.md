# SIPFLOW Project State

## 현재 상태
- **마일스톤**: 1 (MVP — 시각적 시나리오 빌더 + 시뮬레이션 실행)
- **페이즈**: 03 (SIP Engine) 진행 중
- **진행률**: 13/15 plans (87%)
- **상태**: `phase-03-in-progress`
- **최근 활동**: 2026-02-10 — Completed 03-04-PLAN.md (Engine 오케스트레이션 + Wails 바인딩)

**진행 바:** █████████████░░ (13/15)

## 세션 연속성
- **Last session:** 2026-02-10
- **Stopped at:** Completed 03-04-PLAN.md
- **Resume file:** None

## 프로젝트 메모리

### 비즈니스 규칙
- Command 노드는 SIP 액션을 능동적으로 실행하는 노드
- Event 노드는 SIP 이벤트를 수동적으로 대기하는 노드
- 각 노드는 반드시 하나의 SIP 인스턴스에 할당되어야 함
- 시나리오 그래프는 DAG(방향 비순환 그래프) 형태

### 도메인 지식
- diago의 Diago 타입이 SIP UA 인스턴스의 엔트리포인트
- DialogSession 인터페이스가 통화 세션의 추상화
- Bridge 타입은 2자 통화만 지원 (현재)
- 지원 코덱: PCMU, PCMA, Opus, Telephone-event

### 기술적 제약
- Wails v2 Windows hot reload 불안정 (Linux에서 개발 권장)
- diago Hold/Unhold: 빈 SDP 처리 이슈 (#110)
- XYFlow stroke-dasharray 성능 문제 → SVG animateMotion 사용
- diago Bridge는 코덱 호환성 필수 (트랜스코딩 미지원)

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

## 차단 요소 / 우려사항

### 해결됨
- ~~diago dependency go mod tidy 제거 이슈~~ → 블랭크 임포트로 해결 (01-01)
- ~~Wails 바인딩 타입 import 에러~~ → models.ts namespace import로 해결 (02-05)

### 현재
- libwebkit 시스템 의존성 누락 (Linux 프로덕션 빌드 시 필요, 개발은 가능)
- npm audit moderate 취약점 (프로덕션 전 수정 필요)
