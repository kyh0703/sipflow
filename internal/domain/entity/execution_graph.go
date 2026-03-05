package entity

// ExecutionGraph는 전체 실행 그래프
type ExecutionGraph struct {
	Instances map[string]*InstanceChain // instanceID -> 체인
	Nodes     map[string]*GraphNode     // nodeID -> 노드
}
