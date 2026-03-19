# SIPFLOW — SIP Call Flow Simulator

## 프로젝트 개요

SIPFLOW는 SIP(Session Initiation Protocol) 콜플로우를 시각적으로 구성하고 시뮬레이션/실행하는 데스크톱 애플리케이션입니다. VoIP/SIP 개발자와 QA 테스터가 복잡한 SIP 시나리오를 드래그앤드롭으로 구성하고, N개의 SIP 인스턴스를 동시에 실행하여 콜플로우를 검증할 수 있습니다.

## 관련 문서

- 현재 상태: [state.md](state.md)
- 장기 로드맵: [roadmap.md](roadmap.md)
- 활성 요구사항: [../product-specs/active/v1.4-core-call-stability.md](../product-specs/active/v1.4-core-call-stability.md)
- 설계 리서치: [../design-docs/research/](../design-docs/research/)
- v1.4 회귀 매트릭스: [../design-docs/research/v1.4-core-call-stability/regression-matrix.md](../design-docs/research/v1.4-core-call-stability/regression-matrix.md)
- v1.4 검증 hardening: [../design-docs/research/v1.4-core-call-stability/verification-hardening.md](../design-docs/research/v1.4-core-call-stability/verification-hardening.md)
- v1.4 성능 준비 baseline: [../design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md](../design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md)

## 핵심 가치

- **시각적 시나리오 빌더**: XYFlow 기반 노드 에디터로 SIP 콜플로우를 직관적으로 구성
- **Command/Event 아키텍처**: SIP 액션(Command)과 이벤트 대기(Event)를 노드로 분리하여 정확한 콜플로우 모델링
- **N개 SIP 인스턴스**: 다중 SIP UA를 동시에 생성하여 복잡한 시나리오(삼자통화, Transfer 등) 검증
- **이중 모드**: 로컬 시뮬레이션 모드 + 실제 SIP 트래픽 생성 모드

## 타겟 사용자

- **VoIP/SIP 개발자**: SIP 기반 애플리케이션 개발 시 콜플로우 검증
- **QA/테스터**: SIP 서비스 테스트 자동화 및 시나리오 재현

## 현재 릴리스

- **Latest Release**: v1.3 — MuteTransfer + callID UI (2026-03-09)
- **Current Milestone**: v1.4 — 기본 콜 기능 안정화
- **Next Step**: v1.4 close summary와 다음 milestone 결정

## 최근 마일스톤 요약

- **v1.0 — MVP**: Wails 데스크톱 앱, XYFlow 시나리오 빌더, diago 실행 엔진, 실시간 실행 시각화
- **v1.1 — 미디어 + DTMF**: 코덱 설정, WAV RTP 재생, RFC 2833 DTMF 송수신
- **v1.2 — Transfer + UI 개선**: Hold/Retrieve, BlindTransfer, Activity Bar + Resizable UI
- **v1.3 — MuteTransfer + callID UI**: 멀티 다이얼로그, Replaces REFER 전환, `callId` 기반 UI

## 문서 맵

- 시스템 구조와 노드 모델: [../ARCHITECTURE.md](../ARCHITECTURE.md)
- 현재 상태와 누적 결정: [state.md](state.md)
- 장기 로드맵과 마일스톤 흐름: [roadmap.md](roadmap.md)
- 현재 활성 요구사항: [../product-specs/active/v1.4-core-call-stability.md](../product-specs/active/v1.4-core-call-stability.md)
- 현재 회귀 baseline: [../design-docs/research/v1.4-core-call-stability/regression-matrix.md](../design-docs/research/v1.4-core-call-stability/regression-matrix.md)
- 현재 검증 proof map: [../design-docs/research/v1.4-core-call-stability/verification-hardening.md](../design-docs/research/v1.4-core-call-stability/verification-hardening.md)
- 현재 성능 준비 baseline: [../design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md](../design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md)

## Current State

현재 source of truth는 다음 문서가 나눈다.

- 제품 개요와 목표: 이 문서
- 현재 운영 상태와 다음 액션: [state.md](state.md)
- 마일스톤 요구사항과 검증 기준: [../product-specs/active/v1.4-core-call-stability.md](../product-specs/active/v1.4-core-call-stability.md)
- 구조와 기술적 제약: [../ARCHITECTURE.md](../ARCHITECTURE.md)
- Phase 17 시나리오 baseline: [../design-docs/research/v1.4-core-call-stability/regression-matrix.md](../design-docs/research/v1.4-core-call-stability/regression-matrix.md)
- Phase 18 exact proof map: [../design-docs/research/v1.4-core-call-stability/verification-hardening.md](../design-docs/research/v1.4-core-call-stability/verification-hardening.md)
- Phase 19 performance-ready baseline: [../design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md](../design-docs/research/v1.4-core-call-stability/performance-ready-baseline.md)
