# Docs Routing

`docs/` 아래 문서를 수정하거나 참조할 때는 먼저 어떤 문서가 source of truth인지 고른다.

## 읽기 순서

1. 프로젝트 방향과 현재 상태를 볼 때:
   [project/overview.md](project/overview.md),
   [project/state.md](project/state.md),
   [project/roadmap.md](project/roadmap.md)
2. 현재 마일스톤 요구사항을 볼 때:
   [product-specs/active/](product-specs/active/)
3. 아키텍처/설계 근거를 볼 때:
   [ARCHITECTURE.md](ARCHITECTURE.md),
   [design-docs/](design-docs/)
4. 실행 계획을 작성하거나 갱신할 때:
   [PLANS.md](PLANS.md),
   [exec-plans/active/](exec-plans/active/)
5. 완료된 이력이나 예전 `.planning` 자산을 추적할 때:
   [product-specs/archive/](product-specs/archive/),
   [exec-plans/completed/legacy-phases/](exec-plans/completed/legacy-phases/),
   [archive/planning/](archive/planning/)

## 규칙

- 현재 작업 기준은 `project/` + `product-specs/active/`가 우선이다.
- 설계 근거는 `design-docs/`에 둔다. 실행 절차성 문서는 `exec-plans/`에 둔다.
- 완료된 마일스톤 요구사항과 감사 결과는 `product-specs/archive/`로 보존한다.
- 레거시 `.planning` 흔적은 `archive/` 또는 `exec-plans/completed/legacy-phases/`에만 남긴다.
