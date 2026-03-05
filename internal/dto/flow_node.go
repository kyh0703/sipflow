package dto

// FlowNode는 JSON 노드 표현이다.
type FlowNode struct {
	ID   string
	Type string
	Data map[string]any
}
