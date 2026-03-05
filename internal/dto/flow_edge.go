package dto

// FlowEdge는 JSON 엣지 표현이다.
type FlowEdge struct {
	ID           string
	Source       string
	Target       string
	SourceHandle string
	Data         map[string]any
}
