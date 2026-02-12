# 06-01 Summary: Backend 코덱 데이터 모델 + diago 통합

## 완료된 작업

### 단계 1: graph.go — SipInstanceConfig.Codecs 필드 추가
- `SipInstanceConfig` 구조체에 `Codecs []string` 필드 추가
- `getStringArrayField()` 헬퍼 함수 추가 (JSON `[]interface{}` → `[]string` 안전 변환)
- `ParseScenario()`에서 `codecs` 필드 파싱, 기본값 `["PCMU", "PCMA"]` 적용

### 단계 2: instance_manager.go — stringToCodecs + WithMediaConfig 적용
- `stringToCodecs()` 헬퍼: 코덱 이름 문자열 → `media.Codec` 변환
  - `PCMU` → `media.CodecAudioUlaw`, `PCMA` → `media.CodecAudioAlaw`
  - `telephone-event` 항상 마지막에 자동 추가 (DTMF 지원)
  - 알 수 없는 코덱 이름은 무시
- `CreateInstances()`에서 `diago.WithMediaConfig(diago.MediaConfig{Codecs: codecs})` 적용

### 단계 3: graph_test.go — 코덱 파싱 테스트 4개 추가
- `TestParseScenario_CodecsField`: 커스텀 코덱 순서 파싱 검증
- `TestParseScenario_CodecsDefault`: codecs 미설정 시 기본값 검증 (v1.0 호환)
- `TestParseScenario_CodecsEmpty`: 빈 배열 → 기본값 폴백 검증
- `TestParseScenario_CodecsInvalid`: 잘못된 코덱 이름 보존 검증

### 단계 4: executor.go — 코덱 협상 실패 감지
- `executeAnswer()`에서 Answer 에러 분석 (codec/media/negotiat 키워드)
- 협상 실패 시 인스턴스 코덱 정보 디버그 로깅
- "488 Not Acceptable" 에러 메시지 반환

## 검증 결과
- `go build ./...` 성공
- `go test ./internal/engine/...` 전체 통과

## 수정된 파일
- `internal/engine/graph.go` (Codecs 필드 + getStringArrayField + ParseScenario)
- `internal/engine/graph_test.go` (4개 테스트 추가)
- `internal/engine/instance_manager.go` (stringToCodecs + WithMediaConfig)
- `internal/engine/executor.go` (488 감지 + 디버그 로깅)

## 커밋
- `f2ea6fc` feat(06-01): Backend 코덱 데이터 모델 + diago 통합
