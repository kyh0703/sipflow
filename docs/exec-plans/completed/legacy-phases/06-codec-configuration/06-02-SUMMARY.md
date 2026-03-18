# 06-02 Summary: Frontend 코덱 선택 UI + 노드 표시

## 완료된 작업

### 단계 1: scenario.ts — 타입 + 상수 추가
- `SipInstanceNodeData`에 `codecs?: string[]` optional 필드 추가
- `AVAILABLE_CODECS = ['PCMU', 'PCMA'] as const` 상수 추가
- `DEFAULT_CODECS: string[] = ['PCMU', 'PCMA']` 상수 추가

### 단계 2: canvas.tsx — 새 SIP Instance 노드 기본 코덱
- `onDrop` 핸들러에서 sipInstance 생성 시 `codecs: [...DEFAULT_CODECS]` 추가
- `DEFAULT_CODECS` import 추가

### 단계 3: codec-list-item.tsx — 드래그 가능한 코덱 항목 (신규)
- HTML5 Drag and Drop API 기반 구현
- `nodrag` 클래스 적용 (React Flow 충돌 방지)
- GripVertical 아이콘 + 코덱 이름 + 페이로드 타입 레이아웃
- 드래그 중 `opacity-50`, 오버 시 `bg-accent` 시각 피드백
- `CODEC_PAYLOAD_TYPES` 매핑 (PCMU: 0, PCMA: 8)

### 단계 4: sip-instance-properties.tsx — 코덱 선택 섹션
- Color Picker 아래에 "Preferred Codecs" 섹션 추가
- `moveCodec()` 핸들러: splice로 코덱 순서 변경 → `onUpdate()` 호출
- `displayCodecs` 변수로 안전한 기본값 폴백
- "Drag to reorder priority." 설명 텍스트

### 단계 5: sip-instance-node.tsx — 코덱 배지 표시
- DN 표시 영역 아래에 코덱 텍스트 표시
- `data.codecs && data.codecs.length > 0 ? data.codecs : DEFAULT_CODECS` 패턴
- `text-xs text-muted-foreground` 스타일

## 검증 결과
- `npm run build` (TypeScript 컴파일) 성공
- 타입 에러 없음

## 수정된 파일
- `frontend/src/features/scenario-builder/types/scenario.ts` (타입 + 상수)
- `frontend/src/features/scenario-builder/components/canvas.tsx` (기본 코덱)
- `frontend/src/features/scenario-builder/components/properties/codec-list-item.tsx` (신규)
- `frontend/src/features/scenario-builder/components/properties/sip-instance-properties.tsx` (코덱 UI)
- `frontend/src/features/scenario-builder/components/nodes/sip-instance-node.tsx` (코덱 표시)

## 커밋
- `f2ea6fc` feat(06-01): Backend 코덱 데이터 모델 + diago 통합 (frontend 포함)
