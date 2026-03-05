package entity

// InstanceChain은 인스턴스별 실행 체인
type InstanceChain struct {
	Config     SipInstanceConfig
	StartNodes []*GraphNode // 인스턴스 노드에서 직접 연결된 시작 노드들
}
