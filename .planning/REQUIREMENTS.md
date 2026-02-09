# SIPFLOW Requirements

## 마일스톤 1: MVP — 시각적 시나리오 빌더 + 시뮬레이션 실행

### 목표
SIP 콜플로우 시나리오를 시각적으로 구성하고 로컬에서 시뮬레이션 실행할 수 있는 데스크톱 앱

---

## 기능 요구사항

### F1. 프로젝트 기반 (Wails + React)
- **F1.1**: Wails v2 데스크톱 앱 기반 구조 (Go 백엔드 + React 프론트엔드)
- **F1.2**: Go↔Frontend 바인딩으로 SIP 엔진과 UI 연동
- **F1.3**: 시나리오 파일 저장/불러오기 (JSON 기반)

### F2. 시나리오 빌더 (XYFlow)
- **F2.1**: 노드 팔레트 — Command/Event 노드를 사이드바에서 드래그앤드롭으로 캔버스에 추가
- **F2.2**: Command 노드 (MVP Phase 2): MakeCall, Answer, Release — 이후 Phase에서 Hold, Retrieve, BlindTransfer, AttendedTransfer, Response, Register 추가
- **F2.3**: Event 노드 — INCOMING, DISCONNECTED, RINGING, TIMEOUT, HELD, RETRIEVED, TRANSFERRED, NOTIFY
- **F2.4**: 노드 속성 편집 — 선택한 노드의 SIP 파라미터 설정 (SIP URI, 응답 코드, 타임아웃 등)
- **F2.5**: 엣지 연결 — 노드 간 연결로 실행 흐름 정의 (성공/실패 분기)
- **F2.6**: SIP 인스턴스 정의 — N개의 SIP UA 인스턴스를 정의하고 각 노드에 인스턴스 할당
- **F2.7**: 시나리오 유효성 검증 — 시작/종료 노드 존재, 연결 완성도 등 검증

### F3. SIP 엔진 (Go Backend)
- **F3.1**: diago 기반 SIP UA 인스턴스 N개 동시 생성/관리
- **F3.2**: Command 실행기 — 시나리오 그래프를 순회하며 Command 노드 실행
- **F3.3**: Event 리스너 — SIP 이벤트를 감지하고 대응하는 Event 노드 트리거
- **F3.4**: 시뮬레이션 모드 — 실제 네트워크 없이 로컬에서 SIP 메시지 흐름 시뮬레이션
- **F3.5**: 실제 실행 모드 — diago를 통해 실제 SIP 트래픽 생성

### F4. 실행 모니터
- **F4.1**: 실시간 메시지 애니메이션 — 실행 중 XYFlow 캔버스에서 노드 간 메시지 흐름 시각화
- **F4.2**: 로그 패널 — SIP 메시지 상세 로그 (시간, 방향, 메서드, 응답코드)
- **F4.3**: 타임라인 패널 — 시간축 기반 SIP 메시지 시퀀스 표시

### F5. UI/UX
- **F5.1**: shadcn/ui + Tailwind CSS 기반 모던 UI
- **F5.2**: 다크모드 지원
- **F5.3**: 레이아웃 — 좌측 노드 팔레트 + 중앙 캔버스 + 우측 속성 패널 + 하단 로그/타임라인

---

## 비기능 요구사항

### NF1. 성능
- 100개 이상 노드에서 캔버스 인터랙션 원활 (SVG animateMotion 사용)
- SIP 인스턴스 최소 10개 동시 실행

### NF2. 안정성
- SIP 세션 비정상 종료 시 graceful cleanup
- 시나리오 자동 저장 (로컬 스토리지)

### NF3. 빌드/배포
- 단일 바이너리 배포 (Wails embed.FS)
- Linux 지원 (MVP), Windows/macOS (향후)

---

## 범위 외 (Out of Scope)

- WebRTC 지원
- SIP 래더 다이어그램 (향후 마일스톤)
- 멀티유저 협업
- SIP Proxy/Registrar 서버 기능
- 미디어 재생/녹음 기능 (향후 마일스톤)
