# SIPFLOW Roadmap

## 마일스톤 1: MVP — 시각적 시나리오 빌더 + 시뮬레이션 실행

---

### Phase 1: 프로젝트 스캐폴딩 및 기본 구조
> Wails + React + TypeScript + Tailwind + shadcn/ui 프로젝트 초기화

**목표**: 개발 환경 구축 및 Go↔React 통신 검증

**Plans:** 3 plans

Plans:
- [x] 01-01-PLAN.md — Wails v2 프로젝트 초기화 + Go 백엔드 패키지 구조 + diago 의존성
- [x] 01-02-PLAN.md — Tailwind CSS v4 + shadcn/ui + @xyflow/react + zustand 설정
- [x] 01-03-PLAN.md — Go↔React 바인딩 검증 (ping/pong) + 사용자 확인

**성공 기준**: `wails dev`로 앱 실행, Go↔React 양방향 통신 동작 확인

**요구사항 매핑**: F1.1, F1.2

---

### Phase 2: 시나리오 빌더 — 캔버스 및 노드 시스템
> XYFlow 기반 노드 에디터 핵심 구현

**목표**: Command/Event 노드를 캔버스에 배치하고 연결하는 시나리오 빌더

**Plans:** 6 plans

Plans:
- [x] 02-01-PLAN.md — TypeScript types + Zustand store + Canvas shell
- [x] 02-02-PLAN.md — Go backend — SQLite repository + Wails scenario binding
- [x] 02-03-PLAN.md — Custom nodes + Node palette + 3-panel layout
- [x] 02-04-PLAN.md — Edge connection system + Properties panel
- [x] 02-05-PLAN.md — Scenario tree + CRUD integration (frontend-backend wiring)
- [x] 02-06-PLAN.md — Scenario validation + error display + final verification

**성공 기준**: Command/Event 노드 배치, 연결, 속성 편집, JSON 저장/불러오기 동작

**요구사항 매핑**: F2.1~F2.7, F1.3

---

### Phase 3: SIP 엔진 — Go 백엔드 핵심
> diago 기반 SIP 인스턴스 관리 및 시나리오 실행 엔진

**목표**: Go 백엔드에서 시나리오 그래프를 실행하는 엔진 구현

**작업**:
- SIP 인스턴스 매니저 — diago UA N개 생성/관리
- 시나리오 그래프 파서 — 프론트엔드 JSON → Go 실행 그래프 변환
- Command 실행기 — 각 Command 노드에 대응하는 diago API 호출
- Event 리스너 — diago 이벤트 → 그래프 노드 트리거
- 시뮬레이션 모드 — Mock SIP 메시지 생성 (네트워크 없이)
- 실제 실행 모드 — diago를 통한 실제 SIP 트래픽
- Wails 바인딩 — 시나리오 로드/실행/정지/상태 조회 API
- 실행 이벤트 스트림 — Go → Frontend 실시간 이벤트 발행

**성공 기준**: 시나리오를 로드하고 시뮬레이션 모드에서 실행, 이벤트 스트림 프론트엔드 수신

**요구사항 매핑**: F3.1~F3.5, F1.2

---

### Phase 4: 실행 모니터 — 시각화 및 로그
> 실행 중 시나리오의 실시간 시각화 및 로깅

**목표**: 시나리오 실행 상태를 실시간으로 시각화

**작업**:
- 노드 상태 시각화 — 실행 중/완료/에러 상태 표시 (색상/아이콘)
- 엣지 메시지 애니메이션 — SVG animateMotion으로 메시지 흐름 시각화
- 로그 패널 — SIP 메시지 상세 로그 (시간, 방향, 메서드, 응답코드)
- 타임라인 패널 — 시간축 기반 SIP 메시지 시퀀스
- 실행 제어 — 시작/정지/일시정지 버튼

**성공 기준**: 시나리오 실행 시 실시간 노드 상태 변경, 메시지 애니메이션, 로그/타임라인 표시

**요구사항 매핑**: F4.1~F4.3

---

### Phase 5: UI 완성 및 통합 테스트
> 전체 UI 완성도 향상 및 E2E 통합

**목표**: 프로덕션 품질의 UI 및 안정성 확보

**작업**:
- 전체 레이아웃 완성 — 좌측 팔레트 + 중앙 캔버스 + 우측 속성 + 하단 로그
- 다크모드 지원
- 파일 메뉴 — 시나리오 새로 만들기/열기/저장/다른이름으로 저장
- 시나리오 자동 저장 (로컬 스토리지)
- SIP 세션 graceful cleanup
- E2E 시나리오 테스트 — 시뮬레이션 모드로 기본 콜플로우 검증
- Wails 빌드 — 단일 바이너리 생성 검증

**성공 기준**: 완성된 UI, 기본 시나리오(발신→응답→종료) E2E 동작, 빌드 바이너리 정상 실행

**요구사항 매핑**: F5.1~F5.3, NF1~NF3

---

## 향후 마일스톤 (예정)

### 마일스톤 2: 고급 시나리오 + SIP 래더
- SIP 래더 다이어그램 시각화
- 조건 분기 노드 (IF/SWITCH)
- 반복 노드 (LOOP)
- 시나리오 템플릿 라이브러리

### 마일스톤 3: 미디어 + 녹음
- 미디어 재생 (WAV/PCMU)
- 통화 녹음
- DTMF 송신/수신 노드
- 코덱 선택 UI

### 마일스톤 4: 멀티플랫폼 + 배포
- Windows/macOS 빌드
- 자동 업데이트
- 시나리오 내보내기/공유
