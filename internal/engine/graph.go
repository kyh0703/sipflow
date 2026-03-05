package engine

import (
	"encoding/json"
	"fmt"

	"github.com/kyh0703/sipflow/internal/domain/entity"
	"github.com/kyh0703/sipflow/internal/dto"
	"github.com/kyh0703/sipflow/internal/engine/mapper"
)

// ParseScenario는 dto.FlowData JSON 문자열을 entity.ExecutionGraph로 변환한다
func ParseScenario(flowData string) (*entity.ExecutionGraph, error) {
	var flow dto.FlowData
	if err := json.Unmarshal([]byte(flowData), &flow); err != nil {
		return nil, fmt.Errorf("failed to unmarshal flowData: %w", err)
	}

	return mapper.FlowToExecutionGraph(flow)
}
