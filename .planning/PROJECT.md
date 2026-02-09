# SIPFLOW — SIP Call Flow Simulator

## 프로젝트 개요

SIPFLOW는 SIP(Session Initiation Protocol) 콜플로우를 시각적으로 구성하고 시뮬레이션/실행하는 데스크톱 애플리케이션입니다. VoIP/SIP 개발자와 QA 테스터가 복잡한 SIP 시나리오를 드래그앤드롭으로 구성하고, N개의 SIP 인스턴스를 동시에 실행하여 콜플로우를 검증할 수 있습니다.

## 핵심 가치

- **시각적 시나리오 빌더**: XYFlow 기반 노드 에디터로 SIP 콜플로우를 직관적으로 구성
- **Command/Event 아키텍처**: SIP 액션(Command)과 이벤트 대기(Event)를 노드로 분리하여 정확한 콜플로우 모델링
- **N개 SIP 인스턴스**: 다중 SIP UA를 동시에 생성하여 복잡한 시나리오(삼자통화, Transfer 등) 검증
- **이중 모드**: 로컬 시뮬레이션 모드 + 실제 SIP 트래픽 생성 모드

## 타겟 사용자

- **VoIP/SIP 개발자**: SIP 기반 애플리케이션 개발 시 콜플로우 검증
- **QA/테스터**: SIP 서비스 테스트 자동화 및 시나리오 재현

## 기술 스택

| 레이어 | 기술 | 버전 | 용도 |
|--------|------|------|------|
| Desktop Framework | Wails | v2.9.x | Go + WebView 데스크톱 앱 |
| Backend | Go | 1.23+ | SIP 엔진, 시나리오 실행기 |
| SIP Library | emiago/diago | latest | SIP UA 인스턴스 관리, 통화 제어 |
| Frontend | React | 18.x | UI 렌더링 |
| Build Tool | Vite | 5.x | 프론트엔드 빌드 |
| Language | TypeScript | 5.x | 타입 안전성 |
| Node Editor | @xyflow/react | 12.x | 시나리오 빌더 (노드 기반 에디터) |
| UI Components | shadcn/ui | latest | 일관된 UI 컴포넌트 |
| Styling | Tailwind CSS | v4 | 유틸리티 기반 스타일링 |
| State Management | Zustand | latest | 전역 상태 관리 |

## 아키텍처

```
┌─────────────────────────────────────────────────────┐
│                   Wails Desktop App                  │
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
- **Wails Bindings**: 프론트엔드와 통신하는 Go 구조체 (복수 바인딩)

### React Frontend 구조
- **Scenario Builder**: XYFlow 기반 드래그앤드롭 시나리오 에디터
- **Execution Monitor**: 실시간 메시지 애니메이션 + 로그/타임라인 패널
- **Node Palette**: Command/Event 노드를 사이드바에서 캔버스로 드래그

## Command/Event 노드 모델

### Command 노드 (SIP 액션)
| Command | 설명 | diago 매핑 |
|---------|------|-----------|
| MakeCall | 발신 통화 | `Diago.Invite()` |
| Answer | 수신 응답 | `Dialog.Answer()` |
| Hold | 통화 보류 | `Dialog.ReInvite()` (hold SDP) |
| Retrieve | 보류 해제 | `Dialog.ReInvite()` (resume SDP) |
| BlindTransfer | 블라인드 전환 | `Dialog.Refer()` |
| AttendedTransfer | 어텐디드 전환 | `Dialog.ReferOptions()` |
| Release | 통화 종료 | `Dialog.Hangup()` (BYE/CANCEL) |
| Response | SIP 응답 코드 전송 | `Dialog.Respond()` (486, 603 등) |
| Register | SIP 등록 | `Diago.Register()` |

### Event 노드 (SIP 이벤트 대기)
| Event | 설명 | 트리거 조건 |
|-------|------|-------------|
| IncomingCall | 수신 통화 대기 | INVITE 수신 |
| CallConnected | 통화 연결 완료 | 200 OK + ACK |
| CallReleased | 통화 종료 | BYE 수신 |
| HoldEvent | 보류 상태 변경 | Re-INVITE (hold) |
| TransferEvent | 전환 요청 수신 | REFER 수신 |
| DTMFReceived | DTMF 수신 | RTP DTMF |
| Timeout | 타임아웃 | 설정 시간 초과 |
| SIPResponse | 특정 SIP 응답 대기 | 100/180/200/4xx/5xx/6xx |

## 컨벤션

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
- 브랜치: `main` (기본), `feat/*`, `fix/*`
