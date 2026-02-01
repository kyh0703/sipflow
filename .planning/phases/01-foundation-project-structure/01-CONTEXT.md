# Phase 1: Foundation & Project Structure - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Wails v2 데스크톱 앱 프로젝트 구조 수립. Go 백엔드(Clean Architecture), React 프론트엔드(Layer-based), SQLite(ent ORM), Wails 바인딩/이벤트 시스템 패턴 확립. 이 Phase에서는 앱 실행, DB 초기화, Go↔React 통신이 동작하는 것까지.

</domain>

<decisions>
## Implementation Decisions

### 프로젝트 구조
- Go 백엔드: Clean Architecture (domain/usecase/infra/handler 계층 분리)
- React 프론트엔드: Layer-based 구조 (components/, hooks/, services/, stores/)
- 상태 관리: Zustand
- UI 컴포넌트: shadcn/ui (Tailwind 기반)

### SQLite 스키마
- ORM: ent (entgo.io) 사용 — 스키마 정의, 마이그레이션, 쿼리 모두 ent로 처리
- 노드 속성: 노드 테이블에 data JSON 컬럼으로 타입별 속성 저장 (유연한 구조)
- 플로우 관리: flows 테이블 + 노드/엣지가 flow_id FK로 연결
- 엣지 속성: 기본만 (source_node_id, target_node_id, source_handle, target_handle) — 조건분기는 v1에서 불필요

### Go↔React 통신 패턴
- Wails 바인딩: 도메인별 서비스 (FlowService, SIPService, SimulationService 등)
- 실시간 이벤트: Wails EventsEmit/EventsOn 네이티브 방식
- 에러 처리: 구조화된 응답 { success: bool, data: T, error: { code, message } }
- 이벤트 네이밍: "도메인:액션" 컨벤션 (예: "simulation:node-started", "flow:saved")
- TypeScript 타입: Wails 자동생성 타입을 그대로 활용 (Go struct → TS 네이티브 바인딩)

### Claude's Discretion
- 테스트 프레임워크 선택 (Go 테스트, React 테스트)
- Wails 이벤트 레이스 컨디션 방지 핸드셰이크 패턴 구현 방식
- SQLite single-writer 패턴 구현 세부사항
- React Flow nodeTypes 메모이제이션 패턴

</decisions>

<specifics>
## Specific Ideas

- Wails 공식 문서(https://wails.io/ko/docs/guides/application-development) 참고하여 네이티브 Go↔React 통신 활용
- ent ORM으로 스키마 관리 (modernc.org/sqlite cgo-free 드라이버와 호환 필요)
- 리서치에서 식별된 Wails 이벤트 레이스 컨디션(100μs delay workaround) 반드시 반영

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-project-structure*
*Context gathered: 2026-02-01*
