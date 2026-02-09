# SIPFLOW Project State

## 현재 상태
- **마일스톤**: 1 (MVP — 시각적 시나리오 빌더 + 시뮬레이션 실행)
- **페이즈**: 01 완료, 02 대기
- **진행률**: 3/15 plans (20%)
- **상태**: `phase-01-complete`
- **최근 활동**: 2026-02-09 — Phase 01 완료 (검증 통과)

**진행 바:** ███░░░░░░░░░░░░ (3/15)

## 세션 연속성
- **Last session:** 2026-02-09
- **Stopped at:** Phase 01 완료, Phase 02 대기
- **Resume file:** None

## 프로젝트 메모리

### 비즈니스 규칙
- Command 노드는 SIP 액션을 능동적으로 실행하는 노드
- Event 노드는 SIP 이벤트를 수동적으로 대기하는 노드
- 각 노드는 반드시 하나의 SIP 인스턴스에 할당되어야 함
- 시나리오 그래프는 DAG(방향 비순환 그래프) 형태

### 도메인 지식
- diago의 Diago 타입이 SIP UA 인스턴스의 엔트리포인트
- DialogSession 인터페이스가 통화 세션의 추상화
- Bridge 타입은 2자 통화만 지원 (현재)
- 지원 코덱: PCMU, PCMA, Opus, Telephone-event

### 기술적 제약
- Wails v2 Windows hot reload 불안정 (Linux에서 개발 권장)
- diago Hold/Unhold: 빈 SDP 처리 이슈 (#110)
- XYFlow stroke-dasharray 성능 문제 → SVG animateMotion 사용
- diago Bridge는 코덱 호환성 필수 (트랜스코딩 미지원)

### 의사결정 로그
- [2026-02-09] 프로젝트 초기화, MVP 범위 확정
- [2026-02-09] Command/Event 노드 모델 채택
- [2026-02-09] 시뮬레이션 + 실제 실행 이중 모드 결정
- [2026-02-09] Wails v2 + React + Vite 템플릿 채택 (01-01)
- [2026-02-09] internal/ 패키지 구조: engine, scenario, binding (01-01)
- [2026-02-09] Multiple Binding Structs 패턴 채택 (01-01)
- [2026-02-09] diago v0.27.0 SIP 라이브러리 채택 (01-01)
- [2026-02-09] Tailwind CSS v4 CSS 기반 설정 채택 (01-02)
- [2026-02-09] shadcn/ui new-york 스타일 채택 (01-02)
- [2026-02-09] useEffect + useState 바인딩 호출 패턴 (01-03)

## 결정사항 누적

| Plan | 결정 | 이유 | 영향 범위 |
|------|------|------|-----------|
| 01-01 | Wails v2 + React + Vite | 공식 템플릿, TypeScript 우선, HMR | 전체 프로젝트 |
| 01-01 | internal/ 3계층 구조 | 도메인 분리 (engine, scenario, binding) | 백엔드 아키텍처 |
| 01-01 | Multiple Binding Structs | 관심사 분리, 독립적 바인딩 추가 가능 | Frontend-Backend 통신 |
| 01-01 | diago v0.27.0 채택 | sipgo 기반, DialogSession 추상화 | SIP 엔진 구현 |
| 01-02 | Tailwind CSS v4 (CSS 기반) | JS config 불필요, @tailwindcss/vite | 프론트엔드 스타일링 |
| 01-02 | shadcn/ui new-york 스타일 | neutral base color, CSS variables | UI 컴포넌트 |
| 01-03 | useEffect 마운트 패턴 | 비동기 바인딩 호출 + 에러 처리 | 프론트엔드 패턴 |

## 차단 요소 / 우려사항

### 해결됨
- ~~diago dependency go mod tidy 제거 이슈~~ → 블랭크 임포트로 해결 (01-01)

### 현재
- libwebkit 시스템 의존성 누락 (Linux 프로덕션 빌드 시 필요, 개발은 가능)
- npm audit moderate 취약점 (프로덕션 전 수정 필요)
