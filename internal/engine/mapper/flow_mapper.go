package mapper

import (
	"fmt"
	"time"

	"github.com/kyh0703/sipflow/internal/domain/entity"
	"github.com/kyh0703/sipflow/internal/dto"
)

// FlowToExecutionGraph converts flow DTO into execution graph entity.
func FlowToExecutionGraph(flow dto.FlowData) (*entity.ExecutionGraph, error) {
	graph := &entity.ExecutionGraph{
		Instances: make(map[string]*entity.InstanceChain),
		Nodes:     make(map[string]*entity.GraphNode),
	}

	// 1. sipInstance nodes
	nodeTypeMap := make(map[string]string)
	for _, node := range flow.Nodes {
		nodeTypeMap[node.ID] = node.Type

		if node.Type == "sipInstance" {
			config := entity.SipInstanceConfig{
				ID:       node.ID,
				Label:    getStringField(node.Data, "label", ""),
				Mode:     getStringField(node.Data, "mode", "DN"),
				DN:       getStringField(node.Data, "dn", ""),
				Register: getBoolField(node.Data, "register", true),
				Color:    getStringField(node.Data, "color", ""),
				Codecs:   getStringArrayField(node.Data, "codecs", []string{"PCMU", "PCMA"}),
			}
			graph.Instances[node.ID] = &entity.InstanceChain{
				Config:     config,
				StartNodes: []*entity.GraphNode{},
			}
		}
	}

	// 2. command/event nodes
	for _, node := range flow.Nodes {
		if node.Type != "command" && node.Type != "event" {
			continue
		}

		sipInstanceID := getStringField(node.Data, "sipInstanceId", "")
		if sipInstanceID == "" {
			return nil, fmt.Errorf("node %s is missing sipInstanceId", node.ID)
		}
		if _, exists := graph.Instances[sipInstanceID]; !exists {
			return nil, fmt.Errorf("node %s references unknown instance %s", node.ID, sipInstanceID)
		}

		gnode := &entity.GraphNode{
			ID:         node.ID,
			Type:       node.Type,
			InstanceID: sipInstanceID,
			Data:       node.Data,
		}

		if node.Type == "command" {
			gnode.Command = getStringField(node.Data, "command", "")
			gnode.TargetURI = getStringField(node.Data, "targetUri", "")
			gnode.FilePath = getStringField(node.Data, "filePath", "")
			gnode.Digits = getStringField(node.Data, "digits", "")
			gnode.IntervalMs = getFloatField(node.Data, "intervalMs", 100)
			gnode.TransferTarget = getStringField(node.Data, "transferTarget", "")
			gnode.TargetUser = getStringField(node.Data, "targetUser", "")
			gnode.TargetHost = getStringField(node.Data, "targetHost", "")
			timeoutMs := getFloatField(node.Data, "timeout", 10000)
			gnode.Timeout = time.Duration(timeoutMs) * time.Millisecond
		} else {
			gnode.Event = getStringField(node.Data, "event", "")
			gnode.ExpectedDigit = getStringField(node.Data, "expectedDigit", "")
			timeoutMs := getFloatField(node.Data, "timeout", 10000)
			gnode.Timeout = time.Duration(timeoutMs) * time.Millisecond
		}

		graph.Nodes[node.ID] = gnode
	}

	// 3. edges
	for _, edge := range flow.Edges {
		sourceType := nodeTypeMap[edge.Source]
		targetNode, targetExists := graph.Nodes[edge.Target]

		isFailure := edge.SourceHandle == "failure"
		if !isFailure {
			branchType := getStringField(edge.Data, "branchType", "")
			isFailure = branchType == "failure"
		}

		if sourceType == "sipInstance" {
			if targetExists {
				instance := graph.Instances[edge.Source]
				instance.StartNodes = append(instance.StartNodes, targetNode)
			}
			continue
		}

		if sourceType == "command" || sourceType == "event" {
			sourceNode, sourceExists := graph.Nodes[edge.Source]
			if sourceExists && targetExists {
				if isFailure {
					sourceNode.FailureNext = targetNode
				} else {
					sourceNode.SuccessNext = targetNode
				}
			}
		}
	}

	if len(graph.Instances) == 0 {
		return nil, fmt.Errorf("no sipInstance nodes found")
	}

	return graph, nil
}

func getStringField(data map[string]any, key, defaultVal string) string {
	if val, ok := data[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return defaultVal
}

func getBoolField(data map[string]any, key string, defaultVal bool) bool {
	if val, ok := data[key]; ok {
		if b, ok := val.(bool); ok {
			return b
		}
	}
	return defaultVal
}

func getFloatField(data map[string]any, key string, defaultVal float64) float64 {
	if val, ok := data[key]; ok {
		if f, ok := val.(float64); ok {
			return f
		}
	}
	return defaultVal
}

func getStringArrayField(data map[string]any, key string, defaultVal []string) []string {
	if val, ok := data[key]; ok {
		if arr, ok := val.([]any); ok {
			result := make([]string, 0, len(arr))
			for _, v := range arr {
				if s, ok := v.(string); ok {
					result = append(result, s)
				}
			}
			if len(result) > 0 {
				return result
			}
		}
	}
	return defaultVal
}
