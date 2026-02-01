# Phase 2: Visual Flow Designer - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

사용자가 xyflow 캔버스에서 드래그 앤 드롭으로 SIP 콜 플로우를 시각적으로 설계하는 노드 기반 인터페이스. 3가지 노드 타입(SIP Instance, Command, Event)을 캔버스에 배치하고 엣지로 연결하여 실행 순서를 정의한다. 플로우 저장/로드는 Phase 3, SIP 실행은 Phase 5~6 범위.

</domain>

<decisions>
## Implementation Decisions

### 노드 디자인
- lucide-icon 기반 SVG 아이콘으로 노드 타입 및 커맨드 종류 구분
- 노드에는 이름 + 아이콘만 표시 (최소 정보)
- 커맨드별 다른 lucide 아이콘 사용 (MakeCall, Bye, Cancel, Hold 등 각각 고유 아이콘)
- 노드 클릭 시 오른쪽 슬라이드 속성 패널에서 상세 설정

### 캔버스 인터랙션
- 왼쪽 사이드바 팔레트에서 드래그하여 캔버스에 드롭하는 방식으로 노드 추가
- 사이드바는 타입별 그룹 구성 (SIP Instance / Command / Event 섹션, 펼치기/접기)
- 사이드바는 토글 가능 (버튼/단축키로 열기/닫기)
- 캔버스 조작 기능은 `.examples/frontend` 참고하여 Claude 재량으로 결정

### 노드 설정 UI
- 노드 왼쪽 클릭 시 오른쪽에서 슬라이드 인 되는 속성 패널
- 저장/취소 버튼 방식 (자동저장 아님, 명시적 저장 필요)
- SIP Instance 노드: 서버 목록에서 SelectBox로 서버 선택 + 트랜스포트 선택
  - 서버 정보(주소, 포트, 인증 등)는 별도 설정 탭에서 관리
  - Instance에서는 미리 등록된 서버 중 선택하는 구조
- Command 노드: 커맨드 종류별 다른 폼 (MakeCall은 대상 URI, Hold는 대상 세션 등)
- Event 노드: 이벤트 타입별 설정

### 엣지 연결 규칙
- 순차적 플로우 구조: Instance → Command → Event → Command... 순서의 흐름
- 직선 + 화살표 스타일 엣지
- 잘못된 연결 시도 시 연결은 되지만 빨간색 경고 표시

### Claude's Discretion
- 노드 크기 및 타입별 크기 차이
- 캔버스 조작 기능 범위 (`.examples/frontend` 참고)
- 각 커맨드별 구체적인 lucide 아이콘 매핑
- 속성 패널 내부 레이아웃
- 빈 캔버스 상태 표현

</decisions>

<specifics>
## Specific Ideas

- `.examples/frontend`에 기존 구현 참고 가능 (yjs 관련 부분은 제외)
- Tailwind CSS v4 기반 UI 스타일링
- 서버 설정은 글로벌 설정 탭에서 관리하고, SIP Instance에서는 SelectBox로 참조

</specifics>

<deferred>
## Deferred Ideas

- `.examples/frontend`의 yjs(실시간 협업) 기능 제거 — 현재 불필요
- 서버 설정 관리 탭 — Phase 4 (SIP Infrastructure)에서 상세 구현 가능

</deferred>

---

*Phase: 02-visual-flow-designer*
*Context gathered: 2026-02-01*
