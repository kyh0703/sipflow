# SIPFLOW — SIP Call Flow Simulator

## 프로젝트 개요

SIPFLOW는 SIP(Session Initiation Protocol) 콜플로우를 시각적으로 구성하고 시뮬레이션/실행하는 데스크톱 애플리케이션이다. VoIP/SIP 개발자와 QA 테스터가 복잡한 SIP 시나리오를 드래그앤드롭으로 구성하고, N개의 SIP 인스턴스를 동시에 실행하여 콜플로우를 검증할 수 있다.

## 핵심 가치

- **시각적 시나리오 빌더**: XYFlow 기반 노드 에디터로 SIP 콜플로우를 직관적으로 구성
- **Command/Event 아키텍처**: SIP 액션(Command)과 이벤트 대기(Event)를 노드로 분리하여 정확한 콜플로우 모델링
- **N개 SIP 인스턴스**: 다중 SIP UA를 동시에 생성하여 복잡한 시나리오(삼자통화, Transfer 등) 검증
- **이중 모드**: 로컬 시뮬레이션 모드 + 실제 SIP 트래픽 생성 모드

## 기술 스택

| 레이어 | 기술 | 버전 |
|--------|------|------|
| Desktop Framework | Wails | v2.9.x |
| Backend | Go | 1.23+ |
| SIP Library | emiago/diago | v0.27.0 |
| Frontend | React | 18.x |
| Build Tool | Vite | 5.x |
| Language | TypeScript | 5.x |
| Node Editor | @xyflow/react | 12.x |
| UI Components | shadcn/ui | latest |
| Styling | Tailwind CSS | v4 |
| State Management | Zustand | latest |

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

### Go Backend 패키지 구조
- `internal/engine/` — SIP 엔진 (executor, graph, instance_manager, engine)
- `internal/scenario/` — 시나리오 영속성 (SQLite, modernc.org/sqlite CGo-free)
- `internal/binding/` — Wails 바인딩 (복수 바인딩 패턴)

## Command/Event 노드 모델

### Command 노드 (SIP 액션)
| Command | 설명 | diago 매핑 |
|---------|------|-----------|
| MakeCall | 발신 통화 | `Diago.Invite()` |
| Answer | 수신 응답 | `DialogServerSession.AnswerOptions()` |
| Hold | 통화 보류 | `Dialog.ReInvite()` (sendonly SDP) |
| Retrieve | 보류 해제 | `Dialog.ReInvite()` (sendrecv SDP) |
| BlindTransfer | 블라인드 전환 | `Dialog.Refer()` |
| AttendedTransfer | 어텐디드 전환 | `Dialog.ReferOptions()` + Replaces 헤더 |
| Release | 통화 종료 | `Dialog.Hangup()` (BYE/CANCEL) |
| PlayAudio | WAV 재생 | `DialogMedia.Play()` (8kHz mono PCM) |
| SendDTMF | DTMF 전송 | RFC 2833 RTP telephone-event |

### Event 노드 (SIP 이벤트 대기)
| Event | 설명 | 트리거 |
|-------|------|--------|
| IncomingCall | 수신 통화 대기 | INVITE 수신 → incomingCh FIFO |
| CallConnected | 통화 연결 완료 | 200 OK + ACK |
| CallReleased | 통화 종료 | BYE 수신 |
| HeldEvent | 보류 상태 변경 | Re-INVITE (sendonly) |
| RetrievedEvent | 보류 해제 감지 | Re-INVITE (sendrecv) |
| TransferEvent | 전환 요청 수신 | REFER 수신 |
| DTMFReceived | DTMF 수신 | RTP telephone-event |
| Timeout | 타임아웃 | 설정 시간 초과 |

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
- 파일명: kebab-case

### Git
- 커밋 메시지: Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`)
- 브랜치: `main` (기본), `feat/*`, `fix/*`

## 핵심 도메인 지식

- diago의 `Diago` 타입이 SIP UA 인스턴스의 엔트리포인트
- `DialogSession` 인터페이스가 통화 세션의 추상화
- diago `DialogMedia` API가 재생/녹음/DTMF를 모두 지원 (v0.27.0)
- `Bridge` 타입은 2자 통화만 지원, 코덱 transcoding 미지원
- SDP 협상 완료 후에만 `dialog.Media()` 호출 가능
- SIP/RTP는 표준적으로 8kHz mono G.711 사용 (PCMU=0, PCMA=8)
- RFC 2833 RTP telephone-event가 DTMF 표준
- diago `Hold()` 공식 API 없음 — `MediaSession.Mode` + `ReInvite()` 조합 필요
- `AnswerOptions.OnMediaUpdate` 콜백 — HeldEvent/RetrievedEvent 감지
- `AnswerOptions.OnRefer` 콜백 — TransferEvent 감지
- diago Replaces 헤더 자동 구성 미지원 — Call-ID/to-tag/from-tag 수동 추출 필요

## 기술적 제약

- Wails v2 Windows hot reload 불안정 (Linux에서 개발 권장)
- diago Hold/Unhold: 빈 SDP 처리 이슈 (#110) — Re-INVITE로 우회
- XYFlow stroke-dasharray 성능 문제 → SVG animateMotion 사용
- CGO 의존성 회피를 위해 Opus 코덱 제외
- WAV 파일 포맷 불일치 시 재생 속도 왜곡 (8kHz mono PCM 필수)
- diago Call-ID 미지원 (빈 문자열 사용, 향후 diago 업데이트 대기)
- libwebkit 시스템 의존성 누락 (Linux 프로덕션 빌드 시 필요)
