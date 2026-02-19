# Research Summary: Transfer/Hold + UI 개선 (v1.2)

**Project:** SIPFLOW v1.2
**Research Date:** 2026-02-19
**Overall Confidence:** HIGH

---

## Executive Summary

diago v0.27.0은 Blind Transfer(`Refer()`/`ReferOptions()`), Hold/Retrieve(Re-INVITE + `MediaSession.Mode` 조작), REFER/Re-INVITE 수신 감지(`AnswerOptions.OnRefer`, `OnMediaUpdate`)를 완전히 구현하고 있으며 새 라이브러리 추가는 불필요하다. 단, Hold에는 미해결 버그(이슈 #110, #125)가 있어 HoldEvent 수신 측 SDP 방향 감지는 로컬 패치 없이 신뢰할 수 없고, Attended Transfer는 `sipgo.Dialog.Replaces` 미지원으로 Replaces 헤더를 수동 구성해야 한다. UI 개선(팔레트 검색, SIP 래더 확장, 로그 Copy/Clear)은 기존 shadcn/ui + XYFlow 스택으로 완전히 구현 가능하다.

권장 구현 순서는 Hold/Retrieve → BlindTransfer → AttendedTransfer → UI 개선이다. Hold/Retrieve가 먼저인 이유는 Re-INVITE 패턴이 BlindTransfer의 pre-hold 단계와 AttendedTransfer 내부 hold 단계에서 모두 재사용되기 때문이다. AttendedTransfer는 SessionStore 1:N 구조 확장, `incomingCh` 버퍼 증설, Replaces 헤더 수동 구성이라는 세 가지 의존 과제를 Hold/BlindTransfer 이후에 처리하는 것이 리스크 최소화 경로다.

핵심 위험은 두 가지다. 첫째, Hold 발신(ReInvite + sendonly) 자체는 버그 영향이 없지만 상대방이 보내는 Hold를 감지하는 HoldEvent는 diago 버그 #125로 인해 `ms.Mode`가 항상 `sendrecv`를 반환할 수 있어 PR #126 패치 없이는 신뢰 불가다. 둘째, Attended Transfer에서 consultation call의 dialog가 기존 primary dialog를 덮어쓰는 SessionStore 1:1 키 충돌이 발생하므로, AttendedTransfer 페이즈 착수 전에 복합 키(instanceID:role) 구조 확장이 필수다.

---

## Key Findings

### From STACK.md

**핵심 기술 결정:**

| 기술 | 결정 | 근거 |
|------|------|------|
| diago v0.27.0 | 유지 | BlindTransfer, Hold, REFER 수신 API 완전 구현 확인 |
| shadcn/ui | 유지 | Transfer/Hold UI 노드 신규 라이브러리 없이 구현 가능 |
| XYFlow 12.x | 유지 | 노드 팔레트 확장 기존 패턴으로 충분 |

**확인된 API 시그니처 (diago v0.27.0):**

- `DialogClientSession.Refer(ctx, referTo) error` — Blind Transfer 발신
- `DialogClientSession.ReferOptions(ctx, referTo, ReferClientOptions) error` — NOTIFY 콜백 포함
- `DialogServerSession.Refer(ctx, referTo, headers...) error` — REFER 발신(Server 측)
- `DialogClientSession.ReInvite(ctx) error` — Hold/Retrieve Re-INVITE
- `DialogServerSession.ReInvite(ctx) error` — Hold/Retrieve Re-INVITE (서버 측)
- `AnswerOptions.OnRefer func(*DialogClientSession) error` — REFER 수신 감지
- `AnswerOptions.OnMediaUpdate func(*DialogMedia)` — Re-INVITE 수신(HoldEvent) 감지
- `MediaSession.Mode string` — "sendonly"/"sendrecv"/"recvonly" SDP direction 제어
- `sdp.ModeSendonly`, `sdp.ModeSendrecv`, `sdp.ModeRecvonly` 상수

**diago 버그 현황 (2026-02-19):**

| 이슈 | 상태 | 영향 |
|------|------|------|
| #110 (빈 SDP nil) | OPEN | Hold 수신 시 body nil이면 `sdpUpdateUnsafe` 크래시 — "sdp update media remote SDP applying failed" |
| #125 (SDP direction 오류) | CLOSED-duplicate | Hold 응답이 `a=recvonly` 대신 `a=sendrecv` 반환 — HoldEvent 감지 신뢰 불가 |
| PR #126 | 리뷰 대기 | #110/#125 수정 PR — 미병합 |

**결론:** Hold 발신(Re-INVITE + sendonly)은 버그 영향 없음. HoldEvent 수신 감지는 PR #126 적용 또는 에러 catch 방어 로직 필요.

---

### From FEATURES.md

**테이블 스테이크 (v1.2 필수):**

| 기능 | 복잡도 | 메커니즘 |
|------|--------|----------|
| Hold Command | 중간 | `Mode=sendonly` + `ReInvite()` |
| Retrieve Command | 낮음 | `Mode=sendrecv` + `ReInvite()` |
| BlindTransfer Command | 낮음 | `ReferOptions()` + OnNotify 콜백 |
| HELD/RETRIEVED Event | 중간 | `OnMediaUpdate` 콜백 + sipEventSubs |
| TRANSFERRED Event | 중간 | `OnRefer` 콜백 |
| 팔레트 검색 기능 | 낮음 | `useState<string>` + filter |
| 로그 Copy/Clear 버튼 | 낮음 | `navigator.clipboard.writeText()` |
| SIP 래더 REFER/Re-INVITE 표시 | 중간 | 색상 조건 확장 + note 필드 |

**차별화 (v1.2 포함 권장):**

- 팔레트 노드 수 배지 (`Commands (9)`) — 낮음
- 새 노드 아이콘 일관성 (Lucide Icons: PauseCircle, PlayCircle, ArrowRightLeft) — 낮음
- SIP 래더 메서드별 색상 구분 (REFER=보라, Re-INVITE=노랑) — 낮음
- 실행 로그 인스턴스 필터 드롭다운 — 낮음

**안티 기능 (의도적 제외):**

| 제외 기능 | 이유 |
|-----------|------|
| AttendedTransfer v1.2 | SessionStore 리팩토링 + Replaces 수동 구성 고복잡도 — v1.3 |
| NOTIFY Event 노드 별도 구현 | BlindTransfer 내부 로그로 충분 |
| Music on Hold 자동 재생 | Hold + PlayAudio 조합으로 표현 |
| 3자 통화 (Conference) | B2BUA 미디어 믹싱 — v2.0 |
| 팔레트 검색 하이라이팅 | v1.3 폴리시 |
| 로그 파일 Export | v1.3 |
| a=inactive Hold 모드 | sendonly가 표준 — 엣지 케이스 제외 |

**주의:** FEATURES.md는 AttendedTransfer를 안티 기능으로 분류(v1.3)했지만 ARCHITECTURE.md는 구현 코드를 포함하고 있다. 로드맵에서 Phase 3으로 포함하되 복잡도 경고를 명시하는 것이 권장 접근이다.

---

### From ARCHITECTURE.md

**통합 패턴:**

기존 executor/SessionStore 아키텍처와 자연스럽게 통합된다. 새로 생성할 파일 없음 — 모든 변경은 기존 파일 수정.

**수정 대상 파일 (백엔드):**

| 파일 | 변경 내용 |
|------|-----------|
| `internal/engine/graph.go` | `GraphNode`에 `TransferTarget`, `ConsultSessionKey` 필드 추가; 파싱 로직 확장 |
| `internal/engine/executor.go` | SessionStore 복합 키(StoreDialogWithKey) + sipEventSubs 이벤트 버스; executeCommand() 스위치 확장; executeAnswer() AnswerOptions 전환; executeHold/Retrieve/BlindTransfer/AttendedTransfer 신규; executeWaitSIPEvent 신규 |
| `internal/engine/engine.go` | `executor` 필드 승격 (`*Executor`); `emitSIPEvent()` 신규 메서드 |
| `internal/engine/events.go` | `WithSIPMessage()` variadic `note` 파라미터 추가 |

**수정 대상 파일 (프론트엔드):**

| 파일 | 변경 내용 |
|------|-----------|
| `frontend/src/.../types/scenario.ts` | `COMMAND_TYPES` 4개 추가; `CommandNodeData`에 `transferTarget`, `consultSessionKey` 추가 |
| `frontend/src/.../types/execution.ts` | `SIPMessage.note?` 필드 추가 |
| `frontend/src/.../components/node-palette.tsx` | SubSection 컴포넌트; Commands 3개 서브섹션(Call Control/Hold+Transfer/Media) 재구성 |
| `frontend/src/.../components/properties/command-properties.tsx` | Hold/Retrieve 설명 UI; BlindTransfer/AttendedTransfer `transferTarget` 입력 |
| `frontend/src/.../components/properties/event-properties.tsx` | HELD/RETRIEVED/TRANSFERRED/NOTIFY 속성 |
| `frontend/src/.../components/execution-log.tsx` | 인스턴스 필터 드롭다운; Copy All / Clear 버튼 |
| `frontend/src/.../components/execution-timeline.tsx` | 메서드별 색상 구분; note 필드 레이블 표시 |

**핵심 설계 결정:**

1. **SessionStore 복합 키** — `instanceID:role` 패턴으로 primary/consultation dialog 분리. `HangupAll()`은 모든 키 순회하므로 consultation leg도 자동 정리.
2. **SIP 이벤트 버스** — `SessionStore.sipEventSubs map[string][]chan struct{}`로 HELD/RETRIEVED/TRANSFERRED 이벤트를 `executeWaitSIPEvent`에서 블로킹 대기. 이 패턴은 기존 `executeIncoming`의 `incomingCh` 패턴과 일관성 있음.
3. **Engine.executor 필드 승격** — `emitSIPEvent()`가 SessionStore에 접근하려면 Engine이 Executor 참조 보유 필요.
4. **executeAnswer() Answer→AnswerOptions 전환** — `OnMediaUpdate`/`OnRefer` 콜백 등록. nil 콜백은 기존 동작과 동일(소스 `dialog_server_session.go:173-194` 확인) — 기존 테스트 영향 없음.

**데이터 흐름 예시 (BlindTransfer):**

```
executeBlindTransfer:
  1. dialog.(referer).ReferOptions(ctx, referTo, ReferClientOptions{
       OnNotify: func(statusCode) { notifyDone <- statusCode }
     })
     → SIP: REFER → 202 Accepted
  2. NOTIFY(100 Trying) → OnNotify(100)
     NOTIFY(200 OK)     → OnNotify(200) → notifyDone <- 200
  3. <-notifyDone (또는 10초 타임아웃 fallback)
  4. dialog.Hangup(ctx) → SIP: BYE
```

---

### From PITFALLS.md

**치명적 함정 Top 3 + 예방 전략:**

**함정 1: SessionStore 1:1 키 충돌 (AttendedTransfer)**

현재 `map[instanceID]dialog` 구조는 Attended Transfer에서 consultation dialog가 primary dialog를 조용히 덮어쓴다. 원래 통화가 유실되고 Release 노드가 잘못된 dialog를 종료한다.

예방: `StoreDialogWithRole(instanceID, "primary"|"consultation", dialog)` 패턴으로 역할 기반 키 사용. AttendedTransfer 페이즈 착수 전 SessionStore 리팩토링 완료.

**함정 2: REFER 후 BYE 타이밍 — NOTIFY 수신 전 dialog 닫힘**

`Refer()` 직후 즉시 `Hangup()`을 호출하면 최종 NOTIFY가 도착하기 전에 dialog가 닫혀 상대방이 "481 Call/Transaction Does Not Exist"를 받는다.

예방: `ReferOptions.OnNotify` 콜백으로 200 OK sipfrag 수신 후 BYE. 10초 타임아웃 fallback — 타임아웃 시 경고 로그 후 BYE 강행.

**함정 3: incomingCh 버퍼 포화 (AttendedTransfer 수신 측)**

`incomingCh: make(chan ..., 1)` 버퍼 1이라 Attended Transfer 시나리오에서 동일 인스턴스에 두 번째 INVITE 도착 시 채널 포화로 `Serve` goroutine blocking 발생.

예방: `incomingCh` 버퍼를 10으로 확장. non-blocking select + 포화 시 `StatusBusyHere` 응답 옵션.

**추가 주의 함정:**

- **diago #110 빈 SDP:** Hold 수신 시 빈 SDP body 처리 오류 — `"sdp update media remote SDP applying failed"`. 에러 catch 후 경고로 처리하여 크래시 방지.
- **XYFlow DnD 회귀:** 팔레트 DOM 구조 변경 시 DnD 깨짐 위험. `draggable` 속성을 최하위 leaf 컴포넌트에만 적용, 리팩토링 후 즉시 DnD E2E 테스트.
- **diago #91 Content-Length 버그:** v0.27.0에서 수정 여부 불명. BlindTransfer 착수 전 `Refer()` 동작 소규모 테스트 검증 필수.
- **Hold + PlayAudio 충돌:** `PlayAudio` blocking 실행 중 Hold Re-INVITE 수신 시 race condition 가능. Hold 전 PlayAudio 완료 보장하는 시나리오 설계 가이드 필요.

---

## Roadmap Implications

의존성 분석에 기반한 4단계 구조를 권장한다.

### Phase 1: Hold/Retrieve + SIP 이벤트 인프라

**근거:** Re-INVITE 패턴이 가장 단순하고, 이후 모든 단계(BlindTransfer pre-hold, AttendedTransfer 내부 hold)에서 재사용된다. SessionStore 이벤트 버스(`sipEventSubs`)도 이 단계에서 구축해야 HELD/RETRIEVED Event 노드가 동작한다.

**전달물:**
- `executeHold()`, `executeRetrieve()` 구현
- `executeAnswer()` → `AnswerOptions` 전환 (OnMediaUpdate/OnRefer 콜백 등록)
- SessionStore `sipEventSubs` + `SubscribeSIPEvent`/`emitSIPEvent`
- `executeWaitSIPEvent()` for HELD/RETRIEVED
- `engine.go` executor 필드 승격
- `events.go` `WithSIPMessage` note 파라미터
- `graph.go` GraphNode 신규 필드(TransferTarget, ConsultSessionKey)
- 프론트엔드: Hold/Retrieve 노드 + HELD/RETRIEVED Event 등록

**FEATURES.md 기능:** Hold Command, Retrieve Command, HELD Event, RETRIEVED Event

**피해야 할 함정:** 함정 2-빈SDP(#110) catch, 함정 10-ctx 취소 시 hold 상태 정리, 함정 5-PlayAudio 동시 실행 주의

**리서치 플래그:** 표준 Re-INVITE 패턴. 착수 전 `MediaSession.Mode + ReInvite()` 조합 소규모 실험 권장 (예상대로 sendonly SDP 생성되는지 확인).

---

### Phase 2: BlindTransfer

**근거:** Hold 완료 후 REFER 패턴 추가. `ReferOptions.OnNotify` 콜백 패턴이 확립된 이후 Attended Transfer 구현이 더 용이해진다.

**전달물:**
- `executeBlindTransfer()` with `OnNotify` 콜백 + 10초 타임아웃 fallback 후 BYE
- TRANSFERRED Event (`AnswerOptions.OnRefer` 이미 Phase 1에서 등록됨 → executeWaitSIPEvent 재사용)
- `node-palette.tsx` BlindTransfer 팔레트 항목
- `command-properties.tsx` transferTarget 입력 (sip: 접두사 검증)
- `execution-timeline.tsx` REFER 색상 (보라 `#8b5cf6`)

**FEATURES.md 기능:** BlindTransfer Command, TRANSFERRED Event

**피해야 할 함정:** 함정 3(NOTIFY before BYE), 함정 7(diago #91 Content-Length 검증), 함정 8(out-of-dialog NOTIFY 타임아웃 fallback)

**리서치 플래그:** diago v0.27.0에서 `Refer()` Content-Length 버그(#91) 수정 여부 검증 테스트 필수. 문제 발생 시 diago 최신 버전 업그레이드 고려.

---

### Phase 3: AttendedTransfer

**근거:** Hold + BlindTransfer 모두 완료 후, 가장 복잡한 기능. SessionStore 복합 키, Replaces 헤더 수동 구성, incomingCh 버퍼 확장 세 가지 선행 과제 완료 후 착수.

**전달물:**
- SessionStore `StoreDialogWithKey`/`GetDialogWithKey`/`DeleteDialogWithKey` 복합 키 메서드
- `incomingCh` 버퍼 1 → 10 확장
- `executeAttendedTransfer()`: Hold primary → Consultation Invite → Replaces REFER → BYE both
- `command-properties.tsx` AttendedTransfer UI (transferTarget + consultSessionKey)
- `node-palette.tsx` AttendedTransfer 팔레트 항목

**FEATURES.md 기능:** AttendedTransfer Command (FEATURES.md는 v1.3으로 연기 권장했으나 ARCHITECTURE.md가 구현 코드 포함 — 로드맵 결정 필요)

**피해야 할 함정:** 함정 1(SessionStore 1:1 충돌), 함정 4(incomingCh 포화), 함정 6(Executor 체인 한계), 함정 2(Replaces 헤더 tag 추출 검증)

**리서치 플래그:** Replaces 헤더 구성 시 `sipgo.Dialog.CallID`/태그 추출 API 소스 확인 필요. `sipgo.DialogClientSession.InviteResponse.To().Params.Get("tag")` 등 API 직접 검증 권장 (현재 MEDIUM 신뢰도).

---

### Phase 4: UI 개선

**근거:** 기능 구현 완료 후 UX 개선. 백엔드와 독립적이므로 Phase 1~3 병렬 진행 가능. 새 노드 팔레트 항목 추가가 각 페이즈에서 이루어지므로 팔레트 그룹화/검색은 마지막에 정리.

**전달물:**
- `node-palette.tsx` SubSection 컴포넌트 + 검색 input (Command/Hold+Transfer/Media 그룹화)
- 노드 수 배지 (`Commands (9)`)
- `execution-log.tsx` 인스턴스 필터 드롭다운 + Copy All / Clear 버튼
- `execution-timeline.tsx` note 필드 레이블 + 메서드별 색상 완성 (REFER=보라, Re-INVITE=노랑)
- 새 노드 아이콘 일관성 (Hold=PauseCircle, Retrieve=PlayCircle, BlindTransfer=ArrowRightLeft, AttendedTransfer=GitMerge)

**FEATURES.md 기능:** 팔레트 검색, 노드 수 배지, 로그 Copy/Clear, SIP 래더 개선, 아이콘 일관성

**피해야 할 함정:** 함정 9(DnD 브레이킹) — `draggable` 속성을 최하위 leaf 컴포넌트에만 적용, 검색 input에 `className="nodrag"` 추가, 리팩토링 후 즉시 DnD 테스트

**리서치 플래그:** 표준 React 패턴 — 추가 리서치 불필요.

---

## Research Flags

**추가 리서치/검증 필요:**

| 페이즈 | 항목 | 이유 |
|--------|------|------|
| Phase 1 착수 전 | `MediaSession.Mode + ReInvite()` 소규모 실험 | sendonly SDP 생성이 예상대로 동작하는지 확인 |
| Phase 2 착수 전 | diago v0.27.0 `Refer()` Content-Length 검증 | 이슈 #91 수정 여부 불명 (MEDIUM 신뢰도) |
| Phase 3 착수 전 | `sipgo.Dialog` Replaces 태그 추출 API 확인 | `InviteResponse.To().Params.Get("tag")` 실제 존재 여부 (MEDIUM 신뢰도) |
| Phase 3 통합 | HoldEvent 감지 diago #125 영향 평가 | PR #126 미병합 — 패치 적용 또는 SDP 직접 파싱 방어 결정 필요 |

**표준 패턴으로 진행 가능 (추가 리서치 불필요):**

- Phase 1 Hold/Retrieve: Re-INVITE 패턴, `ReInvite()` API 완전 확인
- Phase 2 BlindTransfer: `Refer()` API 완전 확인, NOTIFY 콜백 패턴 확인 (`dialogHandleReferNotify` 소스)
- Phase 4 UI 개선: 기존 React/XYFlow 패턴

---

## Confidence Assessment

| 영역 | 신뢰도 | 참고 |
|------|--------|------|
| BlindTransfer API | HIGH | `Refer()`, `ReferOptions()` 소스 직접 확인; 통합 테스트 `TestIntegrationDialogClientRefer` 존재 |
| Hold/Retrieve API | HIGH | `ReInvite()`, `MediaSession.Mode` 소스 직접 확인 (`media_session.go:102`, `dialog_client_session.go:433`) |
| REFER/Re-INVITE 수신 감지 | HIGH | `OnRefer`, `OnMediaUpdate` 콜백 소스 직접 확인 (`dialog_server_session.go:150-167`) |
| Hold 버그 현황 | HIGH | GitHub #110(OPEN), #125(CLOSED-dup), PR #126(미병합) 직접 확인 (2026-02-19) |
| Hold 발신 구현 | HIGH | 버그 영향 없음 확인 — sendonly 발신 측은 정상 동작 |
| HoldEvent 수신 감지 | MEDIUM | diago #125로 `ms.Mode` 신뢰 불가 — PR #126 패치 없이는 불확실 |
| AttendedTransfer Replaces 헤더 | MEDIUM | sipgo.Dialog 구조체 직접 소스 미확인 — 가정 기반 |
| diago #91 Content-Length 수정 여부 | MEDIUM | v0.27.0에서 수정 여부 불명 — 검증 필요 |
| SessionStore 리팩토링 | HIGH | 소스 구조 직접 분석, 복합 키 패턴 명확 |
| UI 개선 (팔레트/모니터) | HIGH | 기존 컴포넌트 패턴 직접 확인 |

**해결 안 된 갭:**

1. **diago PR #126 병합 상태** — 미병합. HoldEvent 감지의 신뢰성은 이 PR에 의존. Phase 3 전 재확인 필요.
2. **sipgo.Dialog Replaces 태그 추출** — `InviteResponse.To().Params.Get("tag")` API 실제 존재 여부 sipgo 소스 직접 확인 필요. ARCHITECTURE.md 코드는 가정 기반.
3. **diago #91 Content-Length 버그** — v0.27.0 수정 여부 불명. Phase 2 착수 전 소규모 테스트로 검증 필수.

---

## Sources

**HIGH 신뢰도 (소스 직접 확인):**
- `github.com/emiago/diago@v0.27.0/dialog_client_session.go` — Refer(), ReferOptions(), ReInvite()
- `github.com/emiago/diago@v0.27.0/dialog_server_session.go` — Refer(), ReInvite(), AnswerOptions
- `github.com/emiago/diago@v0.27.0/dialog_session.go` — DialogSession 인터페이스, dialogHandleReferNotify()
- `github.com/emiago/diago@v0.27.0/dialog_media.go` — handleMediaUpdate(), sdpUpdateUnsafe()
- `github.com/emiago/diago@v0.27.0/diago.go` — OnRefer/OnNotify 핸들러 등록
- `github.com/emiago/diago@v0.27.0/media/media_session.go` — MediaSession.Mode, LocalSDP()
- `github.com/emiago/diago@v0.27.0/media/sdp/utils.go` — Mode 상수
- `github.com/emiago/diago@v0.27.0/dialog_client_session_test.go` — TestIntegrationDialogClientRefer
- `github.com/emiago/diago@v0.27.0/dialog_server_session_test.go` — TestIntegrationDialogServerRefer

**MEDIUM 신뢰도 (GitHub Issues — 2026-02-19 확인):**
- [diago #110](https://github.com/emiago/diago/issues/110) — Hold 빈 SDP 이슈, OPEN
- [diago #125](https://github.com/emiago/diago/issues/125) — Hold SDP direction 버그, CLOSED-duplicate
- [diago PR #126](https://github.com/emiago/diago/pull/126) — #125 수정 PR, 리뷰 대기
- [diago #95](https://github.com/emiago/diago/issues/95) — Hold API on roadmap, OPEN
- [diago #91](https://github.com/emiago/diago/issues/91) — Content-Length 버그, v0.27.0 수정 여부 불명
- [XYFlow #5310](https://github.com/xyflow/xyflow/issues/5310) — DnD regression

**RFC 표준:**
- RFC 3515 (SIP REFER), RFC 3891 (Replaces), RFC 3264 (SDP Offer/Answer), RFC 5589 (Transfer), RFC 6337 (SIP Hold)

---

## Requirements Definition Readiness

**로드맵 생성 가능 여부: 준비됨**

4단계 페이즈 구조가 명확하게 도출되었으며 각 페이즈의 전달물, 의존성, 함정이 식별되었다. 다음 조건 하에 로드맵 생성 즉시 진행 가능하다.

- Phase 1 (Hold/Retrieve): 즉시 착수 가능. 착수 전 Hold 소규모 실험 권장.
- Phase 2 (BlindTransfer): diago #91 Content-Length 검증 테스트 후 착수.
- Phase 3 (AttendedTransfer): sipgo.Dialog API 소스 확인 후 착수. diago PR #126 상태 재확인 권장. FEATURES.md의 v1.3 연기 권장과 ARCHITECTURE.md의 구현 코드 포함 간 로드맵 결정 필요.
- Phase 4 (UI 개선): 독립적, 언제든 착수 가능.

**로드맵 작성자를 위한 핵심 결정 사항:**

1. AttendedTransfer를 v1.2 Phase 3에 포함할지 v1.3으로 연기할지 결정 (SessionStore 리팩토링 비용 vs 기능 완성도)
2. HoldEvent 수신 감지의 diago PR #126 의존성 — Phase 1에서 패치 적용 여부 결정
