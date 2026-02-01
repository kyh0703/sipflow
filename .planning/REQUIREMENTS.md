# Requirements: SIPFlow

**Defined:** 2026-02-01
**Core Value:** 그린 플로우가 실제 SIP 통신으로 실행되어야 한다. 디자인과 실행이 하나로 연결되는 것이 핵심.

## v1 Requirements

### Foundation

- [ ] **FOUN-01**: Wails v2 + React/Vite 프로젝트 구조 초기화
- [ ] **FOUN-02**: SQLite 스키마 설계 및 초기화 (노드, 엣지, 플로우 테이블)
- [ ] **FOUN-03**: Wails 바인딩을 통한 Go↔React 통신 구조

### Flow Design

- [ ] **FLOW-01**: 캔버스에 SIP 인스턴스 노드를 드래그앤드롭으로 배치하고 UA 속성(SIP URI, 포트) 설정
- [ ] **FLOW-02**: 커맨드 노드(MakeCall, Hold, Retrieve, Blind Transfer, Mute Transfer, Bye, Cancel, 486 Busy)를 캔버스에 배치
- [ ] **FLOW-03**: 이벤트 노드(SIP 이벤트 대기)를 캔버스에 배치
- [ ] **FLOW-04**: 노드 간 엣지로 실행 순서 연결
- [ ] **FLOW-05**: 플로우를 SQLite에 저장하고 불러오기

### SIP Commands

- [ ] **SIPC-01**: MakeCall — diago를 통한 SIP INVITE 발신
- [ ] **SIPC-02**: Bye — 통화 종료 (BYE)
- [ ] **SIPC-03**: Cancel — 발신 중 취소 (CANCEL)
- [ ] **SIPC-04**: Hold — 통화 보류 (re-INVITE sendonly)
- [ ] **SIPC-05**: Retrieve — 보류 해제 (re-INVITE sendrecv)
- [ ] **SIPC-06**: Blind Transfer — REFER를 통한 블라인드 전환
- [ ] **SIPC-07**: Mute Transfer — 음소거 전환
- [ ] **SIPC-08**: 486 Busy — 수신 거부 응답

### SIP Infrastructure

- [ ] **INFR-01**: 외부 SIP 서버(Proxy/Registrar) 연결 설정
- [ ] **INFR-02**: 내장 SIP 서버(sipgo 기반 임베디드 프록시)
- [ ] **INFR-03**: SIP 인스턴스별 UA 생성 및 생명주기 관리 (diago)

### Execution

- [ ] **EXEC-01**: 플로우 그래프를 실행 계획으로 변환 (topological sort)
- [ ] **EXEC-02**: 실행 계획에 따라 diago SIP 커맨드 순차 실행
- [ ] **EXEC-03**: 실행 중 xyflow 애니메이션으로 현재 진행 노드 시각화
- [ ] **EXEC-04**: 실행 결과(성공/실패) 노드별 상태 표시

## v2 Requirements

### Project Management

- **PROJ-01**: 플로우 시나리오 폴더/태그 관리
- **PROJ-02**: 기본 콜 시나리오 템플릿 라이브러리

### Debugging

- **DEBG-01**: SIP 메시지 송수신 트레이스 로그 패널
- **DEBG-02**: 실행 히스토리 저장 및 조회
- **DEBG-03**: Ladder diagram 뷰 (시퀀스 다이어그램)

### Advanced

- **ADVN-01**: 멀티 프로토콜 지원 (RTP/DTMF)
- **ADVN-02**: Step-by-step 디버그 실행 모드

## Out of Scope

| Feature | Reason |
|---------|--------|
| RTP/미디어 처리 | v1은 SIP 시그널링에 집중, 미디어는 별도 도구 |
| 멀티유저 협업 | 데스크톱 단일 사용자 도구로 시작 |
| 웹 배포 | Wails 데스크톱 앱, SIP에 full network access 필요 |
| 코드 생성 | 런타임 실행에 집중, 코드 생성기 아님 |
| 부하 테스트 | 시나리오 테스트 도구, 부하 테스트는 SIPp 등 사용 |
| VoIP 품질 메트릭 (MOS/jitter) | 시그널링 정확성에 집중 |
| SIP 서버 관리 | PBX 관리 도구가 아님 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUN-01 | Phase 1 | Pending |
| FOUN-02 | Phase 1 | Pending |
| FOUN-03 | Phase 1 | Pending |
| FLOW-01 | Phase 2 | Pending |
| FLOW-02 | Phase 2 | Pending |
| FLOW-03 | Phase 2 | Pending |
| FLOW-04 | Phase 2 | Pending |
| FLOW-05 | Phase 3 | Pending |
| SIPC-01 | Phase 5 | Pending |
| SIPC-02 | Phase 5 | Pending |
| SIPC-03 | Phase 5 | Pending |
| SIPC-04 | Phase 7 | Pending |
| SIPC-05 | Phase 7 | Pending |
| SIPC-06 | Phase 8 | Pending |
| SIPC-07 | Phase 8 | Pending |
| SIPC-08 | Phase 9 | Pending |
| INFR-01 | Phase 4 | Pending |
| INFR-02 | Phase 10 | Pending |
| INFR-03 | Phase 4 | Pending |
| EXEC-01 | Phase 6 | Pending |
| EXEC-02 | Phase 6 | Pending |
| EXEC-03 | Phase 6 | Pending |
| EXEC-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0

---
*Requirements defined: 2026-02-01*
*Last updated: 2026-02-01 after roadmap creation*
