# Phase 14 Summary — SessionStore 멀티 다이얼로그

완료일: 2026-03-08

## 완료 항목
- SessionStore를 `instanceID + callID` 복합 키 구조로 확장
- `MakeCall`, `Answer`, `Release`, `PlayAudio`, `SendDTMF`, `Hold`, `Retrieve`, `BlindTransfer`, `MuteTransfer`가 callID 기반 dialog 조회를 사용하도록 정리
- Event 노드가 callID에 대응하는 dialog 기준으로 대기하도록 정리
- `incomingCh` 버퍼를 4로 확장하여 동일 인스턴스 다중 INVITE 수신 기반 마련
- SIP `Call-ID` 기반 eventhandler 패턴 추가
- backend `SupportedCommands` / `SupportedEvents` 공개 및 frontend dev contract 검증 추가

## 검증
- `go test ./internal/pkg/eventhandler ./internal/engine ./internal/binding ...`
- `npm --prefix frontend run build`

## 다음 단계
- Phase 15: `executeAttendedTransfer()` 구현
- Replaces 헤더 구성 + final NOTIFY 대기 + 양쪽 BYE 정리
