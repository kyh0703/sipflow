# SIPFLOW Research Summary

## 1. Wails v2 (Desktop Framework)

### 핵심 정보
- **현재 버전**: v2.9.3 (2025-02)
- **아키텍처**: Go 백엔드 + WebView 프론트엔드 (단일 바이너리)
- **프론트엔드 빌드**: Vite + React + TypeScript 지원
- **에셋 임베딩**: `embed.FS`로 프론트엔드 에셋을 Go 바이너리에 포함
- **바이너리 크기**: ~15MB (Windows/macOS/Linux)

### 프로젝트 구조
```
sipflow/
├── main.go              # 앱 설정 및 실행
├── app.go               # 앱 로직 (바인딩 구조체)
├── wails.json           # 프로젝트 설정
├── frontend/
│   ├── src/             # React 앱
│   ├── dist/            # 빌드 출력 (embed.FS 대상)
│   ├── wailsjs/         # 자동 생성 Go↔JS 바인딩
│   └── package.json
└── build/               # 빌드 설정
```

### Go↔Frontend 통신
- **Bind**: Go 구조체 메서드를 프론트엔드에 노출 (자동 TypeScript 타입 생성)
- **Events**: `runtime.EventsEmit`/`runtime.EventsOn`으로 양방향 이벤트
- **다중 바인딩**: 여러 구조체를 Bind 배열에 추가 가능, OnStartup에서 context 전달

### 주의사항
- Windows에서 hot reload 불안정 이슈 존재
- `--wails-draggable` CSS로 창 드래그 영역 지정
- `EnableDefaultContextMenu` 옵션으로 우클릭 메뉴 제어

### 활용 가능한 템플릿
- `Mahcks/wails-vite-react-tailwind-shadcnui-ts`: React 18 + TypeScript + Vite 5 + Tailwind CSS v4 + shadcn/ui

---

## 2. emiago/diago (SIP Library)

### 핵심 정보
- **모듈**: `github.com/emiago/diago`
- **Go 버전**: 1.23+ (toolchain 1.24.2)
- **의존성**: sipgo, pion/rtp, pion/rtcp, g711, opus
- **라이선스**: MPL-2.0

### 핵심 타입

#### Diago (메인 엔트리포인트)
```go
type Diago struct {
    // SIP UA 인스턴스 관리
}
// N개 인스턴스 생성 가능 → SIPFLOW의 핵심 요구사항 충족
```

#### Phone (전화기 추상화)
- `Dial()`: 발신 통화
- `Answer()`: 수신 응답
- `Register()`: SIP 등록

#### DialogSession (통화 세션)
```go
type DialogSession interface {
    Id() string
    Context() context.Context
    Hangup(ctx context.Context) error
    Media() *DialogMedia
    DialogSIP() *sipgo.Dialog
    Do(ctx context.Context, req *sip.Request) (*sip.Response, error)
    Close() error
}
```

#### DialogClientSession (발신 측)
- `Invite()`, `WaitAnswer()`, `Ack()`: 통화 설정
- `Hangup()`: 통화 종료
- `Refer()`, `ReferOptions()`: 호 전환 (블라인드/어텐디드)
- `ReInvite()`: 미디어 재협상

#### Bridge (B2BUA)
- 2자 통화 미디어 프록시
- 코덱 호환성 검증
- DTMF 패스스루 지원

### 지원 코덱
- PCMU (μ-law), PCMA (A-law)
- Opus (48kHz)
- Telephone-event (DTMF)

### 지원 SIP 기능
- INVITE/BYE/CANCEL
- REGISTER (re-register 루프, Unregister)
- REFER (블라인드/어텐디드 전환)
- Re-INVITE (Hold/Retrieve)
- DTMF (RTP)
- 미디어 재생/녹음 (WAV)

### 제한사항/알려진 이슈
- Hold/Unhold: 빈 SDP 처리 이슈 (#110)
- 호스트명 미해석 (#120)
- Opus 동적 페이로드 타입 (#113)
- TCP 전송 Contact 헤더 (#98)
- Bridge는 2자 통화만 지원

---

## 3. XYFlow / React Flow (노드 에디터)

### 핵심 정보
- **패키지**: `@xyflow/react` v12.10.0
- **변경점 v12**: `reactflow` → `@xyflow/react` (named export)
- **SSR/SSG 지원**, 다크모드, TSDoc 개선
- **추천 상태관리**: Zustand

### Custom Node
```typescript
import { Handle, Position, type NodeProps } from '@xyflow/react';

function CommandNode({ data }: NodeProps) {
  return (
    <div className="command-node">
      <Handle type="target" position={Position.Top} />
      <div>{data.label}</div>
      <Handle type="source" position={Position.Bottom} id="success" />
      <Handle type="source" position={Position.Bottom} id="failure" />
    </div>
  );
}
```

### 시나리오 빌더 패턴
- **노드 팔레트**: 사이드바에서 드래그앤드롭으로 캔버스에 추가
- **Custom Edge**: SVG `animateMotion`으로 메시지 흐름 애니메이션 (stroke-dasharray 대신)
- **직렬화**: `getNodes()`/`getEdges()`로 JSON 저장/로드
- **레이아웃 엔진**: ELKjs 또는 Dagre로 자동 배치

### 성능 최적화
- `stroke-dasharray` 대신 SVG `animateMotion` 사용
- 100+ 노드에서 5프레임 → 2-3프레임 드롭 개선

### Handle 시스템
- `type="source"|"target"`
- 다중 Handle: 고유 `id` 필수
- `isValidConnection`으로 연결 유효성 검증
- 위치: `Position.Top|Right|Bottom|Left`

---

## 4. 아키텍처 의사결정

### Command/Event 노드 모델
| 구분 | Command | Event |
|------|---------|-------|
| 역할 | 능동적 SIP 액션 실행 | SIP 이벤트 대기 |
| 예시 | MakeCall, Hold, Transfer | IncomingCall, CallConnected |
| Handle | Top: 입력, Bottom: 출력 | Top: 트리거, Bottom: 다음 |
| 실행 | diago API 호출 | diago 이벤트 리스너 |

### 기술 스택 통합
```
[Wails Desktop App]
├── Go Backend
│   ├── SIP Engine (diago N개 인스턴스)
│   ├── Scenario Runner (시나리오 실행기)
│   └── Wails Bindings (프론트엔드 바인딩)
└── React Frontend
    ├── Scenario Builder (XYFlow)
    ├── Execution Monitor (로그/타임라인)
    └── UI Components (shadcn/ui + Tailwind)
```
