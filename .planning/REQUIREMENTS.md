# SIPFLOW v1.4 Requirements — 통화 녹음 + 미디어 확장

**Milestone:** v1.4 — 통화 녹음 + 미디어 확장
**Created:** 2026-03-09
**Status:** Draft / Active

---

## 통화 녹음 (REC)

- [ ] **REC-01**: 사용자가 StartRecording 노드를 배치하여 지정한 `callId` dialog의 RTP를 파일로 녹음할 수 있음
- [ ] **REC-02**: 사용자가 StopRecording 노드를 배치하여 활성 녹음을 종료하고 파일을 안전하게 flush/close 할 수 있음
- [ ] **REC-03**: 녹음 파일명이 인스턴스, logical callId, timestamp를 포함해 충돌 없이 자동 생성됨
- [ ] **REC-04**: 녹음 결과가 Stereo WAV(Local/Remote 채널 분리)로 저장됨
- [ ] **REC-05**: 통화 종료/시나리오 중단 시 열린 recorder가 자동 정리되어 손상 파일이나 핸들 누수가 남지 않음

## 미디어 재생 확장 (MED)

- [ ] **MED-01**: PlayAudio 노드에서 `stopOnDTMF` 옵션을 설정하면 DTMF 수신 시 재생이 즉시 중단됨
- [ ] **MED-02**: 재생 중 시작/진행/완료/중단 상태가 이벤트 또는 로그로 발행되어 실행 모니터에서 구분됨
- [ ] **MED-03**: 재생 진행률이 추정 기반 퍼센트 또는 바이트 기준으로 주기적으로 표시됨

## UI / 검증 (UI)

- [ ] **UI-01**: StartRecording / StopRecording 노드가 팔레트에 등록되고 Properties 패널에서 `callId` 기반 설정이 가능함
- [ ] **UI-02**: PlayAudio Properties 패널에 `stopOnDTMF` 옵션과 진행 상태 안내가 추가됨
- [ ] **UI-03**: Validation이 녹음/재생 확장 필수값 누락을 사전에 차단함

---

## 범위 밖 (v1.4)

| 제외 기능 | 이유 |
|-----------|------|
| NOTIFY Event 노드 | 현재는 Transfer 로그로 충분, 녹음/미디어 확장에 집중 |
| loop 재생 | 활용도 대비 우선순위 낮음 |
| 마이크 입력 녹음 | 크로스 플랫폼 오디오 캡처 복잡도 높음 |
| 실시간 파형 시각화 | UI 비용이 크고 핵심 시나리오와 거리 있음 |

## 추적성

| REQ-ID | Planned Phase | Status |
|--------|---------------|--------|
| REC-01 | Phase 17 | Pending |
| REC-02 | Phase 17 | Pending |
| REC-03 | Phase 17 | Pending |
| REC-04 | Phase 17 | Pending |
| REC-05 | Phase 17 | Pending |
| MED-01 | Phase 18 | Pending |
| MED-02 | Phase 18 | Pending |
| MED-03 | Phase 18 | Pending |
| UI-01 | Phase 19 | Pending |
| UI-02 | Phase 19 | Pending |
| UI-03 | Phase 19 | Pending |
