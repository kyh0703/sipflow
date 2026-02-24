# SIPFLOW Project State

## 현재 상태

- **마일스톤**: v1.3 — AttendedTransfer
- **페이즈**: Phase 14 — SessionStore 멀티 다이얼로그 (대기 중)
- **최근 활동**: 2026-02-20 — v1.3 로드맵 + Phase 14 리서치 완료
- **다음 단계**: Phase 14 실행

---

## 완료된 작업

### v1.0 — MVP (2026-02-11) ✅
> 5 phases, 22 plans, 78 commits

- 풀스택 Wails v2 데스크톱 앱 (Go + React + TypeScript)
- XYFlow 기반 시각적 시나리오 빌더 (Command/Event/SIP Instance 노드)
- diago 기반 SIP 실행 엔진 (멀티 인스턴스 병렬 goroutine 실행)
- 실시간 실행 시각화 (SVG animateMotion 엣지 애니메이션, 로그 패널, SIP 래더 다이어그램)
- 프로덕션 UI (next-themes 다크모드, 2000ms debounce 자동 저장, shadcn/ui)
- 22+ Go 테스트, E2E 통합 테스트

### v1.1 — 미디어 + DTMF (2026-02-19) ✅
> 4 phases, 8 plans, 36 commits

- SIP Instance별 코덱 선택 및 우선순위 설정 (PCMU/PCMA, HTML5 DnD 드래그 정렬)
- PlayAudio Command 노드 — WAV 파일 RTP 재생 (8kHz mono PCM, go-audio/wav 즉시 검증)
- SendDTMF Command 노드 — RFC 2833 DTMF 전송 (0-9, *, #, A-D, intervalMs 클램프)
- DTMFReceived Event 노드 — DTMF 수신 + expectedDigit 단일 문자 필터링
- telephone-event 자동 추가 (코덱 설정과 무관하게 DTMF 보장)
- 44개 Go 테스트, v1.0 호환성 통합 테스트

### v1.2 — Transfer + UI 개선 (2026-02-20) ✅
> 4 phases, 7 plans, 32 commits

#### Phase 10: Hold/Retrieve Backend ✅
- `executeAnswer()` → `AnswerOptions()` 리팩토링 (OnMediaUpdate/OnRefer 콜백 수신 전제조건)
- SIP 이벤트 버스 인프라: `map[string][]chan struct{}` + non-blocking send (버퍼 1)
- `OnMediaUpdate` goroutine 분리 (diago `d.mu.Lock()` 재진입 데드락 방지)
- Hold: `MediaSession.Mode(sendonly)` + `ReInvite()` 조합 (diago Hold() API 없음)
- Retrieve: `MediaSession.Mode(sendrecv)` + `ReInvite()`
- `reInviter` 인터페이스 로컬 정의 (diago DialogSession에 ReInvite() 미포함)
- Hold 실패 시 Mode 복원 (sendrecv로 롤백)
- `executeWaitSIPEvent` + defer Unsubscribe 패턴

#### Phase 11: BlindTransfer + TransferEvent Backend ✅
- BlindTransfer: diago `Refer()` API + `referrer` 인터페이스 로컬 정의
- REFER 후 즉시 BYE 전송 (호출자 이탈)
- `OnRefer` 콜백: `sip.Request.Recipient` 필드로 Refer-To URI 추출
- `StoreDialog` 후 `emitSIPEvent(TRANSFERRED)` 순서 (후속 노드가 올바른 dialog 사용)
- TRANSFERRED 이벤트 라우팅: `executeWaitSIPEvent` 재사용

#### Phase 12: UI 리디자인 ✅
- Activity Bar (좌측 아이콘 네비게이션) + shadcn Resizable 사이드바
- `panelRef` prop 사용 (react-resizable-panels v4, React 18 호환)
- `onResize`에서 `asPercentage === 0`으로 collapse 감지 (v4에 onCollapse 없음)
- defaultSize 17+61+22=100% 레이아웃 비율

#### Phase 13: 새 노드 UI + 통합 품질 ✅
- 6개 새 노드 UI (Hold, Retrieve, BlindTransfer, HeldEvent, RetrievedEvent, TransferEvent)
- Properties 패널 auto-expand/collapse (노드 선택 시 expand)
- 56+ Go 테스트, v1.1 하위 호환성 검증 (9/9 must-haves PASS)

---

## 현재 마일스톤: v1.3 — AttendedTransfer

**목표:** SessionStore 복합 키 리팩토링 + Attended Transfer Command 노드 구현

### Phase 14: SessionStore 멀티 다이얼로그 [ 대기 ]

**리서치 완료** → `.context/phase-14/RESEARCH.md`

**목표:** 하나의 SIP 인스턴스에서 복수의 통화를 동시에 관리할 수 있도록 SessionStore를 리팩토링한다.

**요구사항:** SS-01~SS-07

**성공 기준:**
1. 동일 인스턴스에서 `MakeCall(callID="primary")`과 `MakeCall(callID="consult")`를 실행하면 두 개의 독립적인 dialog가 SessionStore에 공존한다
2. `Hold(callID="primary")`를 실행하면 "consult" dialog에 영향 없이 "primary" dialog만 Hold 상태가 된다
3. `Answer(callID="incoming")`를 실행하면 지정된 callID로 수신 dialog가 저장되어 후속 노드에서 참조할 수 있다
4. callID를 지정하지 않은 v1.2 시나리오를 그대로 실행하면 기본값이 적용되어 오류 없이 동일하게 동작한다
5. 동일 인스턴스에서 두 개의 INVITE가 동시에 수신될 때 둘 다 처리된다 (incomingCh 버퍼 확장)

**Plans:**
- [ ] 14-01: SessionStore 복합 키 리팩토링 (백엔드)
- [ ] 14-02: 모든 executor 노드 callID 파라미터 적용

---

### Phase 15: AttendedTransfer 백엔드 [ 대기 ]

**의존성:** Phase 14 완료

**목표:** Transferee UA가 primaryCallID dialog를 통해 Replaces 헤더가 포함된 REFER를 전송하고, NOTIFY 수신 후 양쪽 BYE를 자동 처리한다.

**요구사항:** AT-01~AT-04

**성공 기준:**
1. AttendedTransfer 노드 실행 시 primaryCallID dialog에서 `Refer-To: <UA3-URI>?Replaces=<consult-call-id>%3Bto-tag%3D...%3Bfrom-tag%3D...` 형식의 REFER가 전송된다
2. Replaces 헤더 값이 consultCallID dialog의 SIP Call-ID, to-tag, from-tag를 자동 추출하여 올바르게 구성된다
3. REFER 전송 후 엔진이 NOTIFY(200 OK) 수신을 대기하고, 수신 완료 시 primaryCallID와 consultCallID 양쪽에 BYE를 전송한다
4. Transferee 역할 UA의 OnRefer 콜백에서 Replaces 파라미터가 포함된 REFER를 수신하면 자동으로 Transfer Target에게 INVITE with Replaces를 전송한다

**Plans:**
- [ ] 15-01: executeAttendedTransfer 구현 (REFER+Replaces)
- [ ] 15-02: OnRefer Replaces 감지 + 자동 INVITE 전송

---

### Phase 16: callID UI + AttendedTransfer UI [ 대기 ]

**의존성:** Phase 14 (callID 파라미터 스키마), Phase 15 (AttendedTransfer 노드 타입)

**목표:** 모든 Command/Event 노드 Properties 패널에 callID 입력 필드가 추가되고, AttendedTransfer 노드가 팔레트에 등록된다.

**요구사항:** UI-01~UI-04

**성공 기준:**
1. MakeCall, Answer, Hold, Retrieve, Release, BlindTransfer 노드 Properties 패널에 callID 입력 필드가 표시되고 값을 저장할 수 있다
2. AttendedTransfer 노드가 팔레트 Transfer 카테고리에 아이콘과 함께 표시되고, 캔버스에 드래그하여 배치할 수 있다
3. AttendedTransfer Properties 패널에서 primaryCallID와 consultCallID 값을 설정하면 시나리오 실행 시 해당 값이 엔진에 전달된다
4. callID 필드를 비워두고 v1.2 시나리오를 실행하면 기본값이 자동 적용되어 기존 시나리오가 오류 없이 동작한다

**Plans:**
- [ ] 16-01: 기존 노드 Properties에 callID 필드 추가
- [ ] 16-02: AttendedTransfer 노드 팔레트 + Properties UI

---

## 진행률 요약

```
v1.0 MVP                ██████████ 완료 (5/5 phases)
v1.1 미디어+DTMF        ██████████ 완료 (4/4 phases)
v1.2 Transfer+UI        ██████████ 완료 (4/4 phases)
v1.3 AttendedTransfer   ░░░░░░░░░░ 0/3 phases (Phase 14 대기)
```

**완료된 마일스톤**: 3 (v1.0, v1.1, v1.2)
**총 완료 페이즈**: 13 (Phase 01~13)
**v1.3 남은 페이즈**: 3 (Phase 14, 15, 16)

---

## 핵심 설계 결정 (v1.3)

| 항목 | 결정 | 이유 |
|------|------|------|
| SessionStore 키 구조 | instanceID + callID 복합 키 (`"instanceID:callID"`) | 하나의 인스턴스에서 복수 dialog 관리 |
| callID 기본값 | 마이그레이션에서 "call-1" 자동 주입 | v1.2 시나리오 하위 호환성 보장 |
| incomingCh 버퍼 | 1 → 4 확장 | 동일 인스턴스 다중 INVITE 수신 지원 |
| SIPEvent 채널 | `chan struct{}` → `chan SIPEvent{CallID}` | callID 기반 이벤트 필터링 |
| serverSessions 맵 | 제거 (dialogs에 통합) | IncomingCall이 직접 복합 키로 저장 |
| Replaces 헤더 구성 | 수동 추출 (sipgo.Dialog.Replaces 미지원) | diago API 제약, MEDIUM 신뢰도 |
| AttendedTransfer 접근 | Composable 노드 조합 | Hold + MakeCall + AttendedTransfer 분리 |
| AttendedTransfer 역할 | REFER+Replaces 전송만 담당 | 단일 책임, 다른 노드와 조합 |
| Transferee 자동 처리 | OnRefer에서 Replaces 감지 시 자동 INVITE | 엔진 레벨 처리, 사용자 노드 불필요 |

---

## 차단 요소 / 우려사항

### 현재 활성
- diago Replaces 헤더 자동 구성 미지원 — Call-ID/to-tag/from-tag 수동 추출 필요 (Phase 15에서 구현, MEDIUM 신뢰도)
- diago Hold/Unhold 빈 SDP 이슈 (#110) — Re-INVITE sendonly/sendrecv로 우회 (Phase 10에서 검증됨)
- libwebkit 시스템 의존성 누락 (Linux 프로덕션 빌드 시 필요, 개발은 가능)
- npm audit moderate 취약점 (프로덕션 전 수정 필요)

### 해결됨
- ~~diago dependency go mod tidy 제거 이슈~~ → 블랭크 임포트로 해결
- ~~Wails 바인딩 타입 import 에러~~ → models.ts namespace import로 해결
- ~~diago Call-ID 미지원~~ → 빈 문자열 사용으로 문서화 수용

---

## 향후 마일스톤 (예정)

- **v1.4**: 통화 녹음 + 미디어 확장 (StartRecording/StopRecording, stopOnDTMF, NOTIFY Event)
- **v2.0**: 고급 시나리오 (조건 분기, 반복, 템플릿) + SIP 래더 다이어그램 시각화
- **v3.0**: 멀티플랫폼 빌드 + 자동 업데이트 + 시나리오 공유
