# SIPFLOW Architecture

## 시스템 경계

SIPFLOW는 Wails 기반 데스크톱 애플리케이션이다. 주요 경계는 다음과 같다.

- Go 백엔드: SIP 엔진, 시나리오 실행기, Wails 바인딩
- React 프론트엔드: 시나리오 빌더, 실행 모니터, 설정/UI 상태
- 문서 계층: 제품 설명, 요구사항, 설계 근거, 실행 계획, 아카이브

## 기술 스택

| 레이어 | 기술 | 버전 | 용도 |
|--------|------|------|------|
| Desktop Framework | Wails | v2.9.x | Go + WebView 데스크톱 앱 |
| Backend | Go | 1.23+ | SIP 엔진, 시나리오 실행기 |
| SIP Library | emiago/diago | latest | SIP UA 인스턴스 관리, 통화 제어 |
| Frontend | React | 18.x | UI 렌더링 |
| Build Tool | Vite | 5.x | 프론트엔드 빌드 |
| Language | TypeScript | 5.x | 타입 안전성 |
| Node Editor | @xyflow/react | 12.x | 시나리오 빌더 |
| UI Components | shadcn/ui | latest | 일관된 UI 컴포넌트 |
| Styling | Tailwind CSS | v4 | 유틸리티 기반 스타일링 |
| State Management | Zustand | latest | 전역 상태 관리 |

## 시스템 구조

```text
┌─────────────────────────────────────────────────────┐
│                   Wails Desktop App                 │
├────────────────────────┬────────────────────────────┤
│      Go Backend        │      React Frontend        │
│                        │                            │
│  ┌──────────────────┐  │  ┌──────────────────────┐  │
│  │   SIP Engine     │  │  │  Scenario Builder    │  │
│  │  (diago N개 UA)  │◄─┼──┤  (XYFlow Canvas)     │  │
│  └────────┬─────────┘  │  └──────────────────────┘  │
│           │            │                            │
│  ┌────────▼─────────┐  │  ┌──────────────────────┐  │
│  │ Scenario Runner  │──┼──►  Execution Monitor   │  │
│  │ (실행 엔진)      │  │  │  (로그/타임라인)      │  │
│  └────────┬─────────┘  │  └──────────────────────┘  │
│           │            │                            │
│  ┌────────▼─────────┐  │  ┌──────────────────────┐  │
│  │ Wails Bindings   │──┼──►  UI Components       │  │
│  │ (Go↔JS Bridge)   │  │  │  (shadcn/ui)         │  │
│  └──────────────────┘  │  └──────────────────────┘  │
└────────────────────────┴────────────────────────────┘
```

### Go Backend 구조

- **SIP Engine**: diago 기반 N개 SIP UA 인스턴스 관리
- **Scenario Runner**: 시나리오 그래프를 순회하며 Command 실행/Event 대기
- **Wails Bindings**: 프론트엔드와 통신하는 Go 구조체

### React Frontend 구조

- **Scenario Builder**: XYFlow 기반 드래그앤드롭 시나리오 에디터
- **Execution Monitor**: 실시간 메시지 애니메이션 + 로그/타임라인 패널
- **Node Palette**: Command/Event 노드를 사이드바에서 캔버스로 드래그

## Command/Event 노드 모델

### Command 노드

| Command | 설명 | diago 매핑 |
|---------|------|-----------|
| MakeCall | 발신 통화 | `Diago.Invite()` |
| Answer | 수신 응답 | `Dialog.Answer()` |
| Hold | 통화 보류 | `Dialog.ReInvite()` |
| Retrieve | 보류 해제 | `Dialog.ReInvite()` |
| BlindTransfer | 블라인드 전환 | `Dialog.Refer()` |
| MuteTransfer | 상담 전환 | `Dialog.ReferOptions()` |
| Release | 통화 종료 | `Dialog.Hangup()` |
| Response | SIP 응답 코드 전송 | `Dialog.Respond()` |
| Register | SIP 등록 | `Diago.Register()` |

### Event 노드

| Event | 설명 | 트리거 조건 |
|-------|------|-------------|
| IncomingCall | 수신 통화 대기 | INVITE 수신 |
| CallConnected | 통화 연결 완료 | 200 OK + ACK |
| CallReleased | 통화 종료 | BYE 수신 |
| HoldEvent | 보류 상태 변경 | Re-INVITE 수신 |
| TransferEvent | 전환 요청 수신 | REFER 수신 |
| DTMFReceived | DTMF 수신 | RTP DTMF |
| Timeout | 타임아웃 | 설정 시간 초과 |
| SIPResponse | 특정 SIP 응답 대기 | 100/180/200/4xx/5xx/6xx |

## 문서 아키텍처

문서는 변경 빈도와 책임에 따라 분리한다.

- `project/`
  프로젝트 개요, 현재 상태, 장기 로드맵을 둔다.
- `product-specs/`
  마일스톤 요구사항의 source of truth다.
- `design-docs/`
  구조적 결정, 기술 리서치, 구현 전 설계 근거를 둔다.
- `exec-plans/`
  실행 가능한 작업 계획과 완료 이력을 둔다.
- `archive/`
  더 이상 운영 기준은 아니지만 추적용으로 보존할 자료를 둔다.

## Source Of Truth

- 제품 방향: [project/overview.md](project/overview.md)
- 현재 운영 상태: [project/state.md](project/state.md)
- 릴리스/마일스톤 흐름: [project/roadmap.md](project/roadmap.md)
- 활성 마일스톤 요구사항: [product-specs/active/v1.4-core-call-stability.md](product-specs/active/v1.4-core-call-stability.md)
- 설계 근거: [design-docs/research/](design-docs/research/)
- 실행 계획 lifecycle: [PLANS.md](PLANS.md)

## 운영 원칙

- 살아있는 문서와 보관 문서를 같은 디렉터리에 섞지 않는다.
- 요구사항과 실행 계획을 분리한다.
- 설계 근거는 구현 코드 옆이 아니라 `docs/design-docs/`에 둔다.
- 과거 planning 체계 문서는 레거시 이력로만 남기고, 새 작업은 `docs/` 계층을 사용한다.

## 구현 컨벤션

### Go

- 패키지명: 소문자, 단수형 (`engine`, `scenario`, `binding`)
- 에러 처리: `fmt.Errorf` + `%w` 래핑
- 로깅: `slog` 사용

### TypeScript/React

- 컴포넌트: PascalCase, 함수형 컴포넌트
- 상태관리: Zustand store
- 스타일링: Tailwind CSS 유틸리티 클래스
- 경로 별칭: `@/` → `src/`

### Git

- 커밋 메시지: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`)
- 브랜치: `main`, `feat/*`, `fix/*`
