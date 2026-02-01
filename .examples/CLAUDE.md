# CLAUDE.md

이 파일은 이 저장소에서 작업할 때 Claude Code (claude.ai/code)에 대한 가이드를 제공합니다.

## 개발 명령어

- `pnpm dev` - 포트 8000에서 Turbopack을 사용하여 개발 서버 시작
- `pnpm build` - 프로덕션 번들 빌드
- `pnpm start` - 프로덕션 서버 시작
- `pnpm lint` - Next.js TypeScript 설정으로 ESLint 실행

## 아키텍처 개요

### 핵심 기술 스택

이것은 TypeScript와 React 19를 사용하는 **Next.js 15 애플리케이션**으로, Ansible 워크플로우를 위한 협업 플로우 디자인 도구로 구축되었습니다.

**주요 기술:**
- **@xyflow/react** - 시각적 워크플로우 디자인을 위한 핵심 플로우 다이어그램 엔진
- **Yjs + y-websocket** - 실시간 협업 동기화
- **Zustand** - 영속성 및 개발도구를 포함한 상태 관리
- **TanStack Query** - 서버 상태 관리 및 API 캐싱
- **Tailwind CSS + Radix UI** - 스타일링 및 컴포넌트 라이브러리
- **next-themes** - 테마 관리 (라이트/다크 모드)

### 애플리케이션 구조

**라우트 구성:**
- `(beforeLogin)/` - 랜딩 페이지, 인증 플로우
- `(afterLogin)/` - 인증된 애플리케이션 영역
  - `projects/` - 프로젝트 관리 대시보드
  - `design/[...ids]/` - 메인 플로우 디자인 인터페이스

**디자인 시스템 아키텍처:**
플로우 디자이너는 다음과 같은 핵심 컴포넌트들을 중심으로 구축됩니다:

- **플로우 엔진** (`src/app/(afterLogin)/design/_components/flow/`)
  - 커스텀 노드와 엣지를 포함한 메인 ReactFlow 인스턴스
  - Yjs 통합을 통한 실시간 협업
  - 확장 가능한 데이터 스키마를 가진 커스텀 노드 타입: `start`, `jenkins`

- **협업 기능** (`src/app/(afterLogin)/design/_contexts/yjs-context.tsx`)
  - 실시간 동기화를 위한 WebSocket 프로바이더
  - 공유 커서 및 선택 상태
  - 충돌 없는 협업 편집

- **상태 관리 패턴:**
  - **플로우 상태** (`src/stores/flow-store.ts`) - 플로우별 UI 상태 (선택, 뷰포트)
  - **Yjs 컨텍스트** - 협업 문서 상태
  - **TanStack Query** - 서버 데이터 및 뮤테이션 (`src/services/`)

### 주요 기능

**실시간 협업:**
- Yjs WebSocket을 통한 공유 문서 상태
- 실시간 커서 추적 및 사용자 존재 표시
- 플로우의 충돌 없는 동시 편집

**시각적 플로우 디자이너:**
- 컨트롤 포인트가 있는 커스텀 엣지 라우팅
- 사이드바에서 드래그 앤 드롭 노드 배치
- 정렬을 위한 헬퍼 라인 및 스냅
- 키보드 단축키 및 컨텍스트 메뉴

**데이터 계층:**
- RESTful API 통합 (`src/services/`)
- 뮤테이션 훅을 통한 낙관적 업데이트
- 프로젝트 → 플로우 → 노드/엣지 계층구조로 구성

### 서비스 계층

API 서비스는 기능별로 구성되어 있습니다:
- `auth/` - 인증 및 사용자 관리
- `projects/` - 프로젝트 CRUD 연산
- `flows/` - 플로우 구조 및 메타데이터
- 각 서비스는 `api/`, `queries/`, `mutations/` 하위 디렉터리를 포함

### 설정 참고사항

- **개발 서버**는 포트 8000에서 실행 (3000이 아님)
- **API 프록시**는 `localhost:3000/api/v1/`로 설정
- **SVG 처리**는 @svgr/webpack을 통해 Turbopack과 Webpack 모두에 설정
- **Standalone 출력**이 컨테이너화된 배포를 위해 활성화됨
- **경로 별칭**은 `@/*`를 `./src/*`에 매핑

### 커스텀 훅 패턴

`src/app/(afterLogin)/design/_hooks/`의 플로우별 훅:
- `use-*-state-synced.ts` - 로컬 상태를 Yjs 문서와 동기화
- `use-*-operations.ts` - 복잡한 연산 (노드/엣지 조작)
- `use-key-bind.ts`, `use-shortcut.ts` - 키보드 상호작용 처리

### 타입 확장

`src/types/xyflow.d.ts`에 정의된 커스텀 XYFlow 타입:
- `AppNode`, `AppEdge` - 애플리케이션별 노드/엣지 타입
- `CustomNodeData`, `CustomEdgeData` - 확장된 데이터 스키마
- `ControlPointData` - 엣지 컨트롤 포인트 구조