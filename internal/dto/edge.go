package dto

type EdgeUpsert struct {
	ScenarioID   string  `json:"scenario_id"`
	EdgeID       string  `json:"edge_id"`
	SourceNodeID string  `json:"source_node_id"`
	TargetNodeID string  `json:"target_node_id"`
	SourceHandle *string `json:"source_handle,omitempty"`
	BranchType   string  `json:"branch_type"`
	DataJSON     string  `json:"data_json"`
}
