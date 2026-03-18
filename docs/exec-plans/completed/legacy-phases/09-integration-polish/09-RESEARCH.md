# Phase 9: Integration & Polish — Research

## 요약

Phase 9는 새 미디어 기능(PlayAudio, SendDTMF, DTMFReceived)이 기존 시나리오 구조와 안정적으로 통합되고, 프로덕션 사용을 위한 품질 기준을 충족하도록 하는 통합 및 완성 단계입니다.

**핵심 발견:**
1. **UX 일관성**: PlayAudio, SendDTMF, DTMFReceived 노드는 이미 기존 Command/Event 노드 패턴과 동일하게 구현되어 있음 (아이콘, 색상, 드래그앤드롭, 프로퍼티 패널 모두 일관됨)
2. **테스트 현황**: 기존 5개 *_test.go 파일이 존재하며 graph_test.go, executor_test.go, integration_test.go가 테스트 패턴을 제공함. 미디어/DTMF 관련 코드의 단위 테스트는 아직 없음
3. **회귀 방지**: ParseScenario는 미디어 관련 필드를 optional로 처리하여 v1.0 시나리오(MakeCall→Answer→Release)와 완전 하위 호환. 기존 9개 ParseScenario 테스트가 모두 통과함
4. **E2E 환경**: diago localhost 포트 충돌 이슈로 실제 2-party call 통합 테스트는 현재 skip 처리. TIMEOUT 체인 시뮬레이션 패턴 사용 중
5. **문서화**: README.md가 Wails 기본 템플릿 상태로, 프로젝트 고유 내용으로 교체 필요

**주요 위험**: 미디어/DTMF executor 함수의 테스트 커버리지 부족, diago 의존 코드의 목킹 어려움, 실 SIP 서버 E2E 미수행

## 코드베이스 현황

### Go 백엔드 구조

**디렉토리 구조:**
```
internal/
├── binding/               # Wails 바인딩 (3개 파일)
│   ├── scenario_binding.go
│   ├── engine_binding.go
│   └── media_binding.go   # WAV 검증 (Phase 7에서 추가)
├── engine/                # 실행 엔진 (9개 파일)
│   ├── executor.go        # 628 lines - 미디어/DTMF 실행 로직 포함
│   ├── graph.go           # 230 lines - FilePath/Digits/ExpectedDigit 필드 포함
│   ├── engine.go          # 151 lines
│   ├── events.go          # 107 lines
│   ├── instance_manager.go # 157 lines - stringToCodecs 포함
│   ├── executor_test.go   # 135 lines - SessionStore 테스트만
│   ├── graph_test.go      # 524 lines - ParseScenario 9개 테스트
│   ├── instance_manager_test.go # 168 lines
│   └── integration_test.go # 873 lines - 2-party call skip 처리
└── scenario/              # 시나리오 저장소 (3개 파일)
    ├── repository.go
    ├── model.go
    └── repository_test.go
```

**미디어 관련 파일 분석:**
- `internal/binding/media_binding.go`: WAV 파일 선택 다이얼로그 + 8kHz mono PCM 검증 (go-audio/wav 사용)
- `internal/engine/executor.go`: executePlayAudio (L394-462), executeSendDTMF (L464-530), executeDTMFReceived (L532-615), isValidDTMF (L617-627)
- `internal/engine/graph.go`: FilePath, Digits, IntervalMs, ExpectedDigit 필드 (L38-42)

**기존 테스트 현황:**
- **executor_test.go**: SessionStore 단위 테스트만 (미디어 함수 테스트 없음)
- **graph_test.go**: ParseScenario 9개 테스트 (CodecsField, CodecsDefault 등 포함)
- **integration_test.go**: TestIntegration_TwoPartyCall은 skip 처리 (diago localhost 포트 충돌)

**총 Go 코드**: ~4254 lines

### 프론트엔드 구조

**디렉토리 구조:**
```
frontend/src/features/scenario-builder/
├── components/
│   ├── nodes/
│   │   ├── command-node.tsx      # PlayAudio/SendDTMF 표시 로직 포함
│   │   ├── event-node.tsx        # DTMFReceived 표시 로직 포함
│   │   ├── sip-instance-node.tsx
│   │   └── index.ts
│   ├── properties/
│   │   ├── command-properties.tsx # PlayAudio/SendDTMF 입력 UI
│   │   ├── event-properties.tsx   # DTMFReceived 입력 UI
│   │   ├── sip-instance-properties.tsx
│   │   └── codec-list-item.tsx
│   ├── node-palette.tsx          # PlayAudio/SendDTMF/DTMFReceived 등록
│   └── canvas.tsx                # ReactFlow controlled mode
├── store/
│   ├── scenario-store.ts         # nodes/edges + 앱 상태 혼합
│   └── execution-store.ts        # 런타임 상태
├── types/
│   └── scenario.ts
├── hooks/
│   └── use-dnd.ts
├── edges/
│   └── branch-edge.tsx
└── lib/
    └── validation.ts
```

**UX 일관성 검증:**
- **아이콘**: PlayAudio=Volume2, SendDTMF=Hash, DTMFReceived=Ear (node-palette.tsx L108-119, L172-176)
- **색상**: 모든 Command 노드는 `bg-blue-50 border-blue-400`, Event 노드는 `bg-amber-50 border-amber-400`
- **드래그앤드롭**: 동일한 PaletteItem 컴포넌트 사용, `type="command-PlayAudio"` 패턴
- **프로퍼티 패널**: command-properties.tsx에 PlayAudio/SendDTMF 섹션, event-properties.tsx에 DTMFReceived 섹션 일관되게 통합

**총 Frontend 코드**: ~4376 lines (29개 .tsx/.ts 파일)

## NF-01: UX 일관성 분석

### 기존 노드 패턴

**MakeCall/Answer/Release 구현 (기준선):**
1. **노드 팔레트**: `<PaletteItem type="command-{Name}" icon={Icon} colorClass="bg-blue-50 border-blue-400" />`
2. **캔버스 노드**: `command-node.tsx`에서 `COMMAND_ICONS` 객체로 아이콘 매핑, 통일된 스타일 적용
3. **프로퍼티 패널**: `command-properties.tsx`에서 각 커맨드별 조건부 렌더링 섹션
4. **GraphNode 필드**: graph.go의 GraphNode 구조체에 커맨드별 필드 추가 (TargetURI, Timeout 등)

### 새 노드 구현 (비교)

**PlayAudio:**
- ✅ node-palette.tsx L109-113: `type="command-PlayAudio"`, `icon={Volume2}`, 동일한 blue 색상
- ✅ command-node.tsx L11: `COMMAND_ICONS` 객체에 `PlayAudio: Volume2` 매핑
- ✅ command-node.tsx L65-71: filePath 표시 (파일명만, 말줄임 처리)
- ✅ command-properties.tsx L136-155: WAV 파일 선택 UI (SelectWAVFile 버튼, 파일명 Badge)
- ✅ graph.go L38: `FilePath string` 필드 추가

**SendDTMF:**
- ✅ node-palette.tsx L114-119: `type="command-SendDTMF"`, `icon={Hash}`, 동일한 blue 색상
- ✅ command-node.tsx L12: `COMMAND_ICONS` 객체에 `SendDTMF: Hash` 매핑
- ✅ command-node.tsx L73-77: digits 표시
- ✅ command-properties.tsx L157-196: digits/intervalMs 입력 UI (정규식 필터링, 클램핑)
- ✅ graph.go L39-40: `Digits string`, `IntervalMs float64` 필드 추가

**DTMFReceived:**
- ✅ node-palette.tsx L172-176: `type="event-DTMFReceived"`, `icon={Ear}`, 동일한 amber 색상
- ✅ event-node.tsx L27: `EVENT_ICONS` 객체에 `DTMFReceived: Ear` 매핑
- ✅ event-node.tsx L82-86: expectedDigit 표시
- ✅ event-properties.tsx L82-122: expectedDigit/timeout 입력 UI (단일 문자 제한, timeout 범위)
- ✅ graph.go L42: `ExpectedDigit string` 필드 추가

### 불일치 사항

**없음** - 모든 새 노드가 기존 Command/Event 패턴과 완전히 일치하여 구현되어 있음.

## NF-02: 테스트 대상 분석

### 테스트 가능 순수 함수

| 함수 | 위치 | 복잡도 | 우선순위 | 커버리지 전략 |
|------|------|--------|----------|---------------|
| `isValidDTMF(r rune)` | executor.go L617-627 | 낮음 | **높음** | 경계값: 0-9, *, #, A-D, 유효하지 않은 문자 ('@', 'E', ' ') |
| `stringToCodecs(names []string)` | instance_manager.go | 중간 | **높음** | 코덱 이름 변환 + telephone-event 자동 추가 검증 |
| `ValidateWAVFile(path string)` | binding/media_binding.go | 중간 | **높음** | 8kHz mono PCM 검증, 잘못된 포맷/파일 경로 에러 처리 |
| `ParseScenario(flowData string)` | graph.go L73-181 | 높음 | **중간** | DTMF/Media 필드 파싱 추가 테스트 (기존 9개 테스트 확장) |
| `getStringField`, `getFloatField` | graph.go L184-211 | 낮음 | 낮음 | 기존 ParseScenario 테스트에서 간접 검증됨 |

### 테스트 어려운 diago 의존 코드

**문제점**: diago DialogSession은 인터페이스가 아닌 구체 타입이므로 mock 생성 불가

| 함수 | diago 의존성 | 테스트 전략 |
|------|-------------|------------|
| `executePlayAudio` | `dialog.Media().PlaybackCreate()`, `pb.Play()` | **에러 경로 단위 테스트** (dialog 없음, 파일 없음) + 시뮬레이션 통합 테스트 |
| `executeSendDTMF` | `dialog.Media().AudioWriterDTMF()`, `dtmfWriter.WriteDTMF()` | **에러 경로 단위 테스트** (dialog 없음, digits 없음) + 통합 테스트 |
| `executeDTMFReceived` | `dialog.Media().AudioReaderDTMF()`, `dtmfReader.OnDTMF()` | **에러 경로 단위 테스트** (dialog 없음, timeout) + 통합 테스트 |

### 우선순위 테스트 목록

**Phase 9 범위 (70% 커버리지 목표):**
1. `isValidDTMF` 단위 테스트 (executor_test.go에 추가)
2. `stringToCodecs` 단위 테스트 (instance_manager_test.go에 추가)
3. `ValidateWAVFile` 단위 테스트 (media_binding_test.go 신규 생성)
4. `executePlayAudio` 에러 경로 테스트 (executor_test.go에 추가)
5. `executeSendDTMF` 에러 경로 테스트 (executor_test.go에 추가)
6. `executeDTMFReceived` 에러 경로 테스트 (executor_test.go에 추가)
7. ParseScenario DTMF/Media 필드 테스트 (graph_test.go에 추가)

**커버리지 계산 기준:**
- ROADMAP의 "internal/media/ 패키지"는 존재하지 않음
- 실제 미디어 관련 코드: executor.go의 executePlayAudio/SendDTMF/DTMFReceived (총 ~250 lines) + media_binding.go (총 ~80 lines)
- 70% 목표: 순수 함수 100% + 에러 경로 50% 커버

## NF-03: 회귀 테스트 분석

### v1.0 시나리오 포맷 호환성

**v1.0 기본 시나리오 구조:**
```json
{
  "nodes": [
    {"id": "inst-a", "type": "sipInstance", "data": {"label": "A", "mode": "DN", "dn": "100"}},
    {"id": "cmd-1", "type": "command", "data": {"command": "MakeCall", "sipInstanceId": "inst-a", "targetUri": "sip:200@..."}},
    {"id": "cmd-2", "type": "command", "data": {"command": "Answer", "sipInstanceId": "inst-b"}},
    {"id": "cmd-3", "type": "command", "data": {"command": "Release", "sipInstanceId": "inst-a"}}
  ],
  "edges": [...]
}
```

**ParseScenario 하위 호환 메커니즘:**
```go
// graph.go L126-130 — FilePath, Digits 등이 없으면 빈 문자열 (기본값)
gnode.FilePath = getStringField(node.Data, "filePath", "")
gnode.Digits = getStringField(node.Data, "digits", "")
gnode.IntervalMs = getFloatField(node.Data, "intervalMs", 100)
gnode.ExpectedDigit = getStringField(node.Data, "expectedDigit", "")
```

**검증 결과:**
- ✅ v1.0 시나리오는 미디어 필드가 없으므로 기본값(빈 문자열, 100ms) 적용
- ✅ executor.go의 executeCommand는 MakeCall/Answer/Release만 호출하므로 미디어 코드 실행 없음
- ✅ 기존 9개 graph_test.go 테스트 모두 통과 (TestParseScenario_BasicTwoInstance 등)

### 잠재적 회귀 포인트

**1. Codecs 필드 기본값 처리:**
- 위험: v1.0 시나리오에 `codecs: []` 없으면 `undefined` 전달 가능
- 완화: graph.go L97의 `getStringArrayField(node.Data, "codecs", []string{"PCMU", "PCMA"})` 기본값
- 검증: graph_test.go L440-480 (`TestParseScenario_CodecsEmpty` 통과)

**2. 새 Command 타입 검증 누락:**
- 위험: v1.0 프론트엔드에서 저장한 노드에 `command: "PlayAudio"` 포함 시 executor에서 처리
- 완화: executor.go L172는 unknown command 에러 반환 (명시적 fail)
- 검증: integration_test.go에 v1.0 재현 시나리오 추가 필요

**3. timeout 기본값 변경:**
- 위험: 없음 (v1.0부터 10초 기본값 일관됨)
- 검증: graph_test.go L143 (`evt1.Timeout != 10*time.Second`)

### 회귀 방지 권장 사항

1. **v1.0 재현 통합 테스트 추가**: integration_test.go에 `TestIntegration_V1_0_MakeCallAnswerRelease` 추가
2. **E2E 회귀 스모크 테스트**: Phase 9 완료 후 수동으로 v1.0 시나리오 파일 로드 → 실행 → 정상 동작 확인
3. **schema migration 고려**: 향후 v1.2+에서 필드 제거/변경 시 migration 함수 필요

## E2E 테스트 전략

### 현재 인프라

**integration_test.go 현황:**
- `TestIntegration_TwoPartyCall`: **Skip 처리** (diago localhost 포트 충돌)
- 근본 원인: diago가 outbound INVITE 시 destination 포트로 bind 시도 → "address already in use"
- 프로덕션에서는 다른 IP/머신으로 동작 가능

**대안 패턴 (현재 사용 중):**
```go
// Phase 5에서 도입한 TIMEOUT 체인 시뮬레이션
// Instance A: TIMEOUT 5초
// Instance B: TIMEOUT 3초 (병렬 실행)
// 검증: 노드 상태 전이, ActionLog 이벤트 발행
```

### Phase 9 권장 접근법

**1. 로컬 시뮬레이션 모드 통합 테스트 (우선순위: 높음):**
```go
func TestIntegration_MediaDTMF_Simulation(t *testing.T) {
  // PlayAudio/SendDTMF/DTMFReceived 노드 포함 시나리오
  // 실제 SIP 통화 없이 executor 파이프라인만 검증
  // 기대: ActionLog 이벤트 발행, 노드 상태 전이 (pending→running→completed)
}
```

**2. 외부 SIP 서버 E2E (우선순위: 낮음, 수동 검증):**
- **Asterisk/FreeSWITCH 로컬 설치**: Docker Compose로 통합
- **검증 범위**: PlayAudio 재생 확인, DTMF echo back, 코덱 협상
- **자동화 불가**: ROADMAP 성공기준 4번 충족용으로 Phase 9 계획 외부에서 수행

**3. 유닛 레벨 에러 경로 (우선순위: 높음):**
```go
func TestExecutePlayAudio_NoDialog(t *testing.T)
func TestExecutePlayAudio_FileNotFound(t *testing.T)
func TestExecuteSendDTMF_InvalidDigit(t *testing.T)
```

### 제약사항

- **diago 실제 RTP 검증 불가**: PlaybackCreate/Play는 diago 내부 구현이므로 mocking 어려움
- **RFC 2833 패킷 검증 불가**: diago가 실제 RTP 전송하는지 패킷 캡처 없이 확인 불가
- **코덱 협상 시뮬레이션 불가**: diago SDP 협상 로직 내부 의존

## 문서화 전략

### 기존 문서 구조

**현재 상태:**
- `README.md`: Wails 기본 템플릿 내용 (프로젝트 고유 정보 없음)
- `.planning/`: 개발 계획/연구 문서 (사용자 대면 문서 아님)
- 인앱 도움말: 없음

**문서화 갭:**
1. 프로젝트 소개 및 목적
2. 기술 스택 설명
3. 빌드 및 실행 방법
4. 시나리오 작성 가이드
5. WAV 파일 요구사항 (ROADMAP 성공기준 5)
6. 코덱 선택 가이드 (ROADMAP 성공기준 5)
7. DTMF 사용 예시 (ROADMAP 성공기준 5)

### 권장 문서 위치 및 형태

**README.md 재작성 (우선순위: 높음):**
```markdown
# SIPFLOW — Visual SIP Scenario Builder

## 소개
SIP 통화 시나리오를 시각적으로 설계하고 실행하는 데스크톱 애플리케이션

## 기술 스택
- Frontend: React + TypeScript + XYFlow + Tailwind CSS
- Backend: Go + Wails v2 + diago (SIP engine) + modernc.org/sqlite
- 지원 플랫폼: Linux, Windows, macOS

## 빌드 및 실행
...

## 시나리오 작성 가이드
### 1. SIP Instance 노드
### 2. Command 노드 (MakeCall, Answer, Release, PlayAudio, SendDTMF)
### 3. Event 노드 (INCOMING, DISCONNECTED, RINGING, TIMEOUT, DTMFReceived)

## 미디어 파일 요구사항
**WAV 파일 형식:** 8kHz mono PCM만 지원
**이유:** diago RTP 엔진은 8kHz 샘플레이트 기대, 불일치 시 재생 속도 왜곡
**검증:** 파일 선택 시 자동으로 헤더 검증

## 코덱 선택 가이드
- **PCMU (G.711 μ-law)**: 북미 표준, 가장 높은 호환성
- **PCMA (G.711 A-law)**: 유럽/아시아 표준
- **우선순위 설정**: 드래그앤드롭으로 순서 변경, 첫 번째 코덱이 최우선 협상
- **Fallback**: 협상 실패 시 PCMU로 폴백

## DTMF 사용 예시
### IVR 메뉴 탐색 시나리오
1. Instance A: MakeCall → Answer
2. Instance A: PlayAudio (welcome.wav)
3. Instance A: DTMFReceived (expectedDigit: "1")
4. Instance A: PlayAudio (option1.wav)
```

**인앱 도움말 (우선순위: 낮음, v2.0+):**
- 현재 범위 초과
- 향후 프로퍼티 패널에 `?` 아이콘 툴팁 추가

### 문서 관리 패턴

- README.md는 프로젝트 루트에 단일 파일로 유지
- 별도 docs/ 디렉토리는 생성하지 않음 (복잡도 낮음)
- 코드 주석은 godoc/TSDoc 스타일 유지

## 위험 요소

### 1. 테스트 커버리지 부족 (높음)

**문제:**
- executor.go의 executePlayAudio/SendDTMF/DTMFReceived 함수 미테스트 (~250 lines)
- diago 의존성으로 인한 mock 어려움

**완화 방안:**
- 순수 함수 (isValidDTMF, stringToCodecs, ValidateWAVFile) 우선 100% 커버
- 에러 경로 (dialog 없음, 파일 없음) 단위 테스트 작성
- 시뮬레이션 통합 테스트로 happy path 검증

**잔존 위험:**
- diago 실제 RTP 재생/DTMF 전송 코드 검증 불가 → 수동 E2E로 대체

### 2. diago localhost 포트 충돌 (중간)

**문제:**
- TestIntegration_TwoPartyCall skip 처리
- 실제 SIP 통화 자동화 테스트 불가

**완화 방안:**
- Docker 기반 Asterisk E2E 환경 구축 (Phase 9 범위 외, 추후 수행)
- 수동 검증으로 ROADMAP 성공기준 4 충족

**잔존 위험:**
- CI/CD 파이프라인에서 자동 E2E 테스트 불가

### 3. README 템플릿 상태 (낮음)

**문제:**
- 사용자가 빌드/실행 방법을 알 수 없음
- WAV/코덱/DTMF 가이드 없음

**완화 방안:**
- Phase 9 계획에 README.md 재작성 포함
- ROADMAP 성공기준 5 충족

**잔존 위험:**
- 없음 (단순 문서 작성)

### 4. v1.0 회귀 검증 부족 (낮음)

**문제:**
- 기존 ParseScenario 테스트는 모두 v1.1 구조 (codecs 필드 포함)
- v1.0 실제 시나리오 파일 로드 테스트 없음

**완화 방안:**
- integration_test.go에 v1.0 재현 시나리오 추가
- 수동 E2E로 기존 시나리오 파일 로드 확인

**잔존 위험:**
- 없음 (현재 ParseScenario 하위 호환 메커니즘 안정적)

## 권장 사항

### 계획 수립 시 고려사항

**1. 테스트 작성 우선순위:**
- **Plan 1 (Backend Tests)**: 순수 함수 → 에러 경로 → 시뮬레이션 통합 테스트
- **Plan 2 (Documentation & E2E)**: README.md 재작성 → 수동 E2E 검증

**2. 커버리지 목표 해석:**
- ROADMAP의 "internal/media/ 70%"는 실제 media 패키지가 없으므로 다음과 같이 해석:
  - executor.go의 executePlayAudio/SendDTMF/DTMFReceived (순수 함수 100%, 에러 경로 50%)
  - media_binding.go의 ValidateWAVFile (100%)
  - 통합 계산: ~70% 달성 가능

**3. E2E 테스트 전략:**
- **자동화**: 로컬 시뮬레이션 통합 테스트 (Phase 9 범위 내)
- **수동**: Asterisk/FreeSWITCH 연동 (Phase 9 VERIFICATION에서 수행)

**4. 문서 범위:**
- README.md 재작성으로 성공기준 5 충족
- 인앱 도움말/튜토리얼은 v2.0+ 연기

**5. 리팩토링 범위 (CONTEXT.md 참고):**
- **상태 관리**: scenario-store를 XYFlow uncontrolled mode로 전환 (Plan 1에 포함 가능)
- **Resizable 레이아웃**: shadcn Resizable 적용 (Plan 2 또는 별도 Plan)
- 위 두 항목은 Integration & Polish 범위에 포함 가능하나, ROADMAP 성공기준과 직접 연관 없음 → 선택적 수행

**6. 성공기준 체크리스트:**
- [✅] NF-01: UX 일관성 (이미 달성, 검증만 필요)
- [⚠️] NF-02: 단위 테스트 70% (계획 필요)
- [✅] NF-03: v1.0 호환성 (달성, 통합 테스트 추가 필요)
- [⚠️] 성공기준 4: E2E 테스트 (수동 검증 계획 필요)
- [❌] 성공기준 5: 사용자 문서 (README.md 재작성 필요)

## RESEARCH COMPLETE
