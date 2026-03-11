package binding

import (
	"time"

	"sipflow/internal/scenario"
)

type ScenarioDTO struct {
	ID        string `json:"id"`
	ProjectID string `json:"project_id"`
	Name      string `json:"name"`
	FlowData  string `json:"flow_data"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

type ScenarioListItemDTO struct {
	ID        string `json:"id"`
	ProjectID string `json:"project_id"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

func formatBindingTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}

	return value.Format(time.RFC3339Nano)
}

func newScenarioDTO(source *scenario.Scenario) *ScenarioDTO {
	if source == nil {
		return nil
	}

	return &ScenarioDTO{
		ID:        source.ID,
		ProjectID: source.ProjectID,
		Name:      source.Name,
		FlowData:  source.FlowData,
		CreatedAt: formatBindingTime(source.CreatedAt),
		UpdatedAt: formatBindingTime(source.UpdatedAt),
	}
}

func newScenarioListItemDTO(source scenario.ScenarioListItem) ScenarioListItemDTO {
	return ScenarioListItemDTO{
		ID:        source.ID,
		ProjectID: source.ProjectID,
		Name:      source.Name,
		CreatedAt: formatBindingTime(source.CreatedAt),
		UpdatedAt: formatBindingTime(source.UpdatedAt),
	}
}
