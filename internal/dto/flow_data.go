package dto

// FlowData는 프론트엔드에서 저장하는 JSON 구조를 파싱하기 위한 타입
type FlowData struct {
	Nodes []FlowNode
	Edges []FlowEdge
}
