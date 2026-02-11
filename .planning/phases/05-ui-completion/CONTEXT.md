# Phase 05 Context: UI 완성 및 통합 테스트

> 전체 UI 완성도 향상 및 E2E 통합

## 논의된 영역

1. [다크모드 UX & 전환 동작](#1-다크모드-ux--전환-동작)
2. [자동 저장 동작 & 복구 전략](#2-자동-저장-동작--복구-전략)
3. [E2E 테스트 범위 & 검증 전략](#3-e2e-테스트-범위--검증-전략)

---

## 1. 다크모드 UX & 전환 동작

### 결정사항

**테마 모드:** Light / Dark / System 3가지
- `next-themes` 패키지 활용 (이미 설치됨)
- System 모드: OS 테마 자동 감지 (`prefers-color-scheme`)
- Light/Dark 모드: 사용자 수동 선택

**기본 테마:** System
- 첫 실행 시 OS 테마 자동 적용
- 사용자 선택 후 localStorage에 저장하여 다음 실행 시 유지

**토글 위치:** 헤더 바 우측 끝
- 실행 툴바 / Save 버튼 옆에 아이콘 버튼 배치
- 아이콘: Sun (라이트) / Moon (다크) / Monitor (시스템)
- 클릭 시 Light → Dark → System 순환 또는 드롭다운

**전환 애니메이션:** 즉시 전환
- CSS transition 없이 즉시 클래스 변경
- 데스크톱 앱 특성상 부드러운 전환보다 즉각적인 반응이 적합
- 깜빡임(flash) 방지: `next-themes`의 `attribute="class"` + script injection 활용

**지속성:** localStorage (next-themes 기본 동작)
- `next-themes`가 자동으로 `localStorage.theme` 관리
- 별도 구현 불필요

### 현재 상태 (Phase 5 시작 전)

- `index.css`에 `.dark` 클래스 기반 CSS variables 정의 완료 (라인 83-115)
- `@custom-variant dark (&:is(.dark *))` Tailwind v4 설정 완료
- `next-themes` 패키지 설치됨 (Sonner에서만 사용 중)
- shadcn/ui 컴포넌트 모두 dark mode CSS variable 지원
- ThemeProvider 미설정, 토글 UI 미구현

---

## 2. 자동 저장 동작 & 복구 전략

### 결정사항

**트리거 방식:** 변경 감지 즉시 (debounce 적용)
- 노드/엣지/속성 변경 시 자동 저장 트리거
- debounce 1~2초 적용하여 빈번한 DB 쓰기 방지
- 드래그 중에는 저장하지 않고, 드래그 완료(onNodeDragStop) 시 저장
- Zustand store의 `isDirty` 플래그를 활용한 변경 감지

**저장 대상:** SQLite 직접
- 기존 `SaveScenario` Wails 바인딩 재사용
- 별도 저장소(localStorage 등) 불필요
- 단일 진실 소스(single source of truth) 유지

**인디케이터:** 헤더에 저장 상태 표시
- 현재 시나리오명 옆에 상태 텍스트 표시
  - "Saved" — 저장 완료 (초록색 또는 회색)
  - "변경됨" 또는 dot indicator — 미저장 변경 있음
  - "저장 중..." — 저장 진행 중 (spinner 또는 텍스트)
- 기존 `isDirty` dot indicator 패턴 확장

**충돌 복구:** 불필요
- 변경 즉시 저장(debounce 포함)으로 데이터 손실 최소화
- 별도 복구 메커니즘/대화상자 불필요
- 복잡도 최소화

**기존 수동 저장과의 관계:**
- Ctrl+S / Save 버튼은 유지 (즉시 저장, debounce 무시)
- 자동 저장은 수동 저장의 보완, 대체 아님
- 시나리오 전환 시 미저장 경고는 자동 저장으로 인해 거의 불필요하지만 안전장치로 유지

### 현재 상태 (Phase 5 시작 전)

- `SaveScenario` Wails 바인딩 구현 완료
- Ctrl+S 키보드 단축키 구현됨 (canvas.tsx)
- `isDirty` 플래그로 변경 추적 중
- 시나리오 전환 시 미저장 경고 구현됨
- 자동 저장 로직 미구현

---

## 3. E2E 테스트 범위 & 검증 전략

### 결정사항

**테스트 범위:** Go 백엔드 E2E만
- 프론트엔드 테스트는 MVP 범위 밖 (향후 마일스톤)
- Go 테스트로 시나리오 실행 엔진 전체 검증
- 기존 테스트 파일 5개에 추가하는 형태

**테스트 시나리오:** 발신→응답→종료 (기본 2자 통화)
- Instance A: SIPInstance → MakeCall → DISCONNECTED
- Instance B: SIPInstance → INCOMING → Answer → Release
- 시뮬레이션 모드(로컬 SIP)로 실행
- 검증 항목:
  - 시나리오 시작 → 모든 노드 completed 상태
  - 이벤트 스트림 정상 발행 (노드 상태, 액션 로그)
  - cleanup 완료 (세션 종료, UA 정리)
  - 시나리오 최종 상태 "completed"

**빌드 검증:** wails build + 실행 확인
- `wails build` 성공 여부 확인
- 생성된 바이너리(`build/bin/sipflow`) 실행 가능 여부 수동 확인
- CI 파이프라인은 MVP 이후 고려
- 알려진 이슈: libwebkit 시스템 의존성 (Linux 프로덕션 빌드)

**테스트 실행:** go test 수동
- `go test ./internal/...` 로 전체 테스트 실행
- Makefile/스크립트 추가 없음 (MVP 범위)
- 테스트 실패 시 Phase 5 성공 기준 미달

### 현재 상태 (Phase 5 시작 전)

- Go 테스트 5개 파일 존재:
  - `internal/engine/graph_test.go` — 그래프 파싱
  - `internal/engine/executor_test.go` — Command/Event 실행
  - `internal/engine/instance_manager_test.go` — UA 생성
  - `internal/engine/integration_test.go` — E2E 시나리오 실행
  - `internal/scenario/repository_test.go` — SQLite CRUD
- 프론트엔드 테스트 파일 없음
- `wails build` 설정 존재 (wails.json)

---

## 논의하지 않은 영역 (Claude 판단)

### 파일 메뉴 & 시나리오 관리 UX

사용자가 이 영역을 선택하지 않았으므로, Claude가 기술적으로 판단합니다:

- **window.prompt/confirm 유지:** MVP 단계에서 모달 교체 우선순위 낮음. Phase 04에서 `alert()` → Sonner toast 전환 완료했으나, `window.prompt`는 시나리오 생성/이름변경에서만 사용되어 빈도 낮음.
- **네이티브 메뉴 바:** Wails v2에서 네이티브 메뉴 지원하지만 MVP에서는 현재 인앱 UI 유지. 향후 마일스톤에서 추가 고려.
- **"다른 이름으로 저장":** 현재 미구현. 자동 저장 도입으로 우선순위 낮아짐. 향후 추가 가능.

### SIP 세션 Graceful Cleanup

이미 Phase 03-04에서 완전히 구현됨:
- `HangupAll → CloseAll → IM.Cleanup` 순서 정립
- `StopScenario` 10초 타임아웃
- App shutdown hook에서 자동 cleanup
- 추가 작업 불필요

### 전체 레이아웃 완성

Phase 02-04에서 4패널 레이아웃 완성됨:
- 좌측: 시나리오 트리 + 노드 팔레트
- 중앙: XYFlow 캔버스
- 우측: 속성 패널
- 하단: 실행 로그/타임라인 (조건부 렌더링)
- 추가 레이아웃 변경 불필요 (다크모드 토글만 헤더에 추가)

---

## 미뤄진 아이디어

| 아이디어 | 출처 | 비고 |
|----------|------|------|
| 프론트엔드 단위 테스트 (Vitest) | Phase 05 논의 | MVP 이후, 컴포넌트 안정화 후 추가 |
| Playwright 브라우저 E2E | Phase 05 논의 | Wails 환경 설정 복잡, 향후 고려 |
| GitHub Actions CI | Phase 05 논의 | MVP 이후 자동 빌드/테스트 파이프라인 |
| Makefile / 빌드 스크립트 | Phase 05 논의 | 현재 수동 실행으로 충분, 향후 추가 |
| window.prompt → 모달 교체 | Phase 05 분석 | 빈도 낮아 MVP 후 개선 |
| 네이티브 메뉴 바 | Phase 05 분석 | Wails 메뉴 API 활용, 향후 마일스톤 |
| "다른 이름으로 저장" | Phase 05 분석 | 자동 저장으로 우선순위 하락 |

---

## 다음 단계

이 CONTEXT.md를 기반으로:
1. `/prp:plan-phase 5` — Phase 5의 상세 실행 계획(PLAN.md) 생성
