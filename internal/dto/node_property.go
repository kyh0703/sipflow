package dto

type NodePropertyUpsert struct {
	ScenarioID     string `json:"scenario_id"`
	NodeID         string `json:"node_id"`
	SchemaVersion  int64  `json:"schema_version"`
	PropertiesJSON string `json:"properties_json"`
}
