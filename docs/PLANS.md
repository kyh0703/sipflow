# Planning Docs

## 목적

실행 계획은 요구사항 문서와 분리해서 관리한다. 현재 활성 요구사항은
[product-specs/active/v1.4-core-call-stability.md](product-specs/active/v1.4-core-call-stability.md)에 있고,
구체적인 실행 절차 문서는 `exec-plans/` 아래에 둔다.

## 구조

- `exec-plans/active/`
  아직 진행 중이거나 다음 실행을 위해 준비 중인 계획
- `exec-plans/completed/`
  완료된 실행 계획
- `exec-plans/completed/legacy-phases/`
  이전 phase 체계에서 이관한 과거 계획 문서

## 작성 규칙

- 새 계획은 `docs/exec-plans/active/YYYY-MM-DD-<slug>.md` 형식으로 만든다.
- 요구사항은 `product-specs/`에 두고, plan 문서에서는 해당 요구사항 파일을 링크한다.
- 완료된 plan은 `completed/`로 이동한다.
- 레거시 phase 문서는 historical record로 간주하며, 새 작업은 그 형식을 재사용하지 않는다.
