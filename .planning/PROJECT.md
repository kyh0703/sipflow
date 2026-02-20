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

## Current State

**Latest Release**: v1.2 — Transfer + UI 개선 (2026-02-20)

<details>
<summary>v1.0 — MVP (2026-02-11)</summary>

- 풀스택 Wails v2 데스크톱 앱 (Go + React + TypeScript)
- XYFlow 기반 시각적 시나리오 빌더 (Command/Event/SIP Instance 노드)
- diago 기반 SIP 실행 엔진 (멀티 인스턴스 병렬 실행)
- 실시간 실행 시각화 (엣지 애니메이션, 로그 패널, SIP 래더 다이어그램)
- 프로덕션 UI (다크모드, 자동 저장, shadcn/ui)
- 22+ Go 테스트, E2E 통합 테스트
</details>

<details>
<summary>v1.1 — 미디어 + DTMF (2026-02-19)</summary>

- SIP Instance별 코덱 선택 및 우선순위 설정 (PCMU/PCMA, 드래그 정렬)
- PlayAudio Command 노드 — WAV 파일 RTP 재생 (8kHz mono PCM 검증)
- SendDTMF Command 노드 — RFC 2833 DTMF 전송 (0-9, *, #, A-D)
- DTMFReceived Event 노드 — DTMF 수신 및 expectedDigit 필터링
- telephone-event 자동 추가 (코덱 설정과 무관하게 DTMF 보장)
- 44개 Go 테스트, v1.0 호환성 통합 테스트, README 전체 재작성
</details>

v1.2에서 달성한 것:
- Hold/Retrieve Command 노드 — Re-INVITE 기반 통화 보류/해제 (sendonly/sendrecv)
- BlindTransfer Command 노드 — diago Refer() API 기반 블라인드 전환
- HeldEvent/RetrievedEvent/TransferEvent 노드 — SIP 이벤트 버스 기반 이벤트 감지
- Activity Bar + shadcn Resizable 사이드바 — UI 전면 리디자인
- 6개 새 노드 UI 완성 (아이콘, 팔레트, Properties 패널)
- Properties 패널 auto-expand/collapse
- 56+ Go 테스트, v1.1 하위 호환성 검증

## Current Milestone: v1.3 — AttendedTransfer

**목표:** SessionStore 복합 키 리팩토링을 선행하고, Attended Transfer(어텐디드 전환) Command 노드를 구현하여 상담 통화 후 통화를 전환하는 고급 SIP 시나리오를 지원한다.

**타겟 기능:**
- SessionStore 복합 키 리팩토링 (instanceID:role 패턴으로 primary/consultation dialog 분리)
- AttendedTransfer Command 노드 — consultation call 후 Replaces REFER 전송
- incomingCh 버퍼 확장 (동일 인스턴스 다중 INVITE 수신 지원)
- AttendedTransfer 프론트엔드 UI (노드 팔레트, Properties 패널, 아이콘)

### Next Milestone Goals

향후 마일스톤 후보:
- **v1.4**: 통화 녹음 + 미디어 확장 (StartRecording/StopRecording, stopOnDTMF, NOTIFY Event)
- **v2.0**: 고급 시나리오 (조건 분기, 반복, 템플릿) + SIP 래더 다이어그램 시각화
- **v3.0**: 멀티플랫폼 빌드 + 자동 업데이트 + 시나리오 공유

---

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
