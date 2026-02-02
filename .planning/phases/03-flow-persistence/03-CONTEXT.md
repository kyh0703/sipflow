# Phase 3: Flow Persistence - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

캔버스에서 디자인한 플로우(노드, 엣지, 설정값)를 SQLite에 저장하고 복원하는 기능. 프로젝트 단위로 여러 플로우를 관리하며, 세션 간 작업 유지와 시나리오 재사용이 핵심. 실행 엔진이나 SIP 인프라는 이 phase 범위 밖.

</domain>

<decisions>
## Implementation Decisions

### 저장/불러오기 UX
- 수동 저장 (Ctrl+S 또는 저장 버튼) — 사용자가 저장 시점을 직접 제어
- 앱 시작 시 빈 캔버스로 시작 (마지막 플로우 자동 복원 없음)
- Wails 네이티브 메뉴를 통해 프로젝트 열기/저장 (File > Open, File > Save 등)
- "플로우"가 아닌 "프로젝트" 개념으로 접근

### 프로젝트 구조
- 프로젝트 = N개 플로우 (하나의 프로젝트에 여러 시나리오 포함)
- 프로젝트 = 단일 .sipflow DB 파일 (SQLite) — 파일 탐색기에서 공유/복사 가능
- 기존 앱 내부 DB가 아닌, 프로젝트별 독립 DB 파일 방식

### 플로우 관리
- 왼쪽 사이드바에 플로우 목록 표시하여 클릭으로 전환
- 플로우 메타데이터는 이름만 (최소한의 구조)
- 플로우 삭제 시 확인 다이얼로그 표시

### Claude's Discretion
- 캔버스 상태 범위 (뷰포트 줌/팬 저장 여부)
- dirty state 표시 방식 (타이틀바 * 표시 등)
- 사이드바 내 플로우 목록 UI 세부 디자인
- 노드/엣지 직렬화 포맷 (xyflow 상태 → SQLite 매핑)
- 데이터 무결성 및 저장 실패 처리

</decisions>

<specifics>
## Specific Ideas

- 프로젝트 파일 확장자는 .sipflow — 앱과 연결되는 고유 확장자
- Wails 네이티브 메뉴 활용 (데스크톱 앱답게 File 메뉴 패턴)
- 기존 Phase 1에서 구축한 앱 내부 SQLite DB와 별개로, 프로젝트별 DB 파일로 전환 필요

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-flow-persistence*
*Context gathered: 2026-02-02*
