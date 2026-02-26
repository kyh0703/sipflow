# AGENTS.md

Local execution protocol for this repository.

## Mandatory Read Order

1. Read `.context/STATE.md` first.
2. Read `.context/phases/<current_phase>.md` second.
3. Read applicable policy docs before coding:
   - `.context/PAYMENT_CREDIT_POLICY.md`
   - `.context/AI_PIPELINE_POLICY.md`
   - `.context/I18N_POLICY.md`
4. Read supporting docs only as needed.

## Execution Rules

- Implement only tasks relevant to the current phase.
- Do not introduce subscription logic.
- Keep credit handling ledger-first and auditable.
- Treat webhook confirmation as payment truth.
- Preserve bilingual support (`ko`, `en`) in user-facing features.

## State Update Rules

- When work starts, update `.context/STATE.md`:
  - `phase_status`
  - `active_tasks`
  - `last_updated`
- When work ends, update `.context/STATE.md`:
  - `completed_phases` (if applicable)
  - `next_actions`
  - `open_questions`
  - `last_updated`

## Delivery Discipline

- Keep changes scoped to the requested task.
- Prefer simple and testable implementations.
- Record new architecture/product decisions as ADR files in `.context/decisions/`.
