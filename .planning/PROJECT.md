# SIPFlow

## What This Is

SIP 개발자와 QA를 위한 데스크톱 콜플로우 디자이너. xyflow 기반 캔버스에서 SIP UA 인스턴스, 커맨드(MakeCall, Hold, Transfer 등), 이벤트 노드를 배치하고 연결하여 SIP 시나리오를 시각적으로 설계한 뒤, diago SIP 스택을 통해 실제 SIP 시그널링으로 실행하는 E2E 테스트 도구.

## Core Value

그린 플로우가 실제 SIP 통신으로 실행되어야 한다. 디자인과 실행이 하나로 연결되는 것이 핵심.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] SIP 인스턴스 노드를 캔버스에 생성하고 UA 설정(SIP URI, 포트 등) 구성
- [ ] 커맨드 노드 지원: MakeCall, Hold, Retrieve, Blind Transfer, Mute Transfer, Bye, Cancel, 486 Busy
- [ ] 이벤트 노드 지원: HoldEvent 등 SIP 이벤트 대기 노드
- [ ] 노드 간 엣지로 실행 순서 연결
- [ ] SQLite로 플로우(노드/엣지) 저장 및 불러오기
- [ ] 시뮬레이션 시작 시 diago를 통해 실제 SIP 시그널링 실행
- [ ] 실행 중 xyflow 애니메이션으로 현재 진행 노드 시각화
- [ ] SIP 서버 내장 지원 (E2E 테스트용)
- [ ] 외부 SIP 서버 연결 지원

### Out of Scope

- RTP/미디어 처리 — v1은 시그널링 플로우에 집중
- 멀티유저 협업 — 데스크톱 단일 사용자 도구
- 웹 배포 — Wails 데스크톱 앱으로 한정
- SIP 메시지 수동 편집 — 커맨드 노드 기반 추상화 레벨 유지

## Context

- Wails v2를 사용한 Go/React 데스크톱 앱 구조
- 프론트엔드: React + Vite + xyflow (노드 기반 플로우 에디터)
- 백엔드: Go + diago (SIP 스택) + SQLite
- diago는 Go 기반 SIP UA 라이브러리로 INVITE, BYE, REFER 등 SIP 시그널링 지원
- SIP 서버 경유 통신 구조 (내장 Proxy 또는 외부 서버)
- 노드 타입 3종: SIP 인스턴스(UA), 커맨드(액션), 이벤트(대기)

## Constraints

- **Tech Stack**: Go + Wails, React/Vite + xyflow, diago, SQLite — 확정
- **Platform**: 데스크톱 앱 (Wails)
- **SIP Stack**: diago (github.com/emiago/diago) — 확정
- **Storage**: SQLite — 확정

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Wails 데스크톱 앱 | Go 백엔드와 React 프론트를 하나의 바이너리로 | — Pending |
| diago SIP 스택 | Go 네이티브 SIP UA 라이브러리, 충분한 시그널링 지원 | — Pending |
| xyflow 플로우 에디터 | 노드/엣지 기반 시각적 편집에 최적화된 라이브러리 | — Pending |
| SQLite 저장소 | 데스크톱 앱에 적합한 임베디드 DB, 별도 서버 불필요 | — Pending |
| 노드 3종 구분 (SIP/커맨드/이벤트) | 역할 분리로 플로우 가독성 확보 | — Pending |

---
*Last updated: 2026-02-01 after initialization*
