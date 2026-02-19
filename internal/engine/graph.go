package engine

import (
	"encoding/json"
	"fmt"
	"time"
)

// FlowData는 프론트엔드에서 저장하는 JSON 구조를 파싱하기 위한 타입
type FlowData struct {
	Nodes []FlowNode
	Edges []FlowEdge
}

// FlowNode는 JSON 노드 표현
type FlowNode struct {
	ID   string
	Type string
	Data map[string]interface{}
}

// FlowEdge는 JSON 엣지 표현
type FlowEdge struct {
	ID           string
	Source       string
	Target       string
	SourceHandle string
	Data         map[string]interface{}
}

// GraphNode는 실행 그래프 노드
type GraphNode struct {
	ID            string
	Type          string // command|event
	InstanceID    string
	Command       string        // MakeCall|Answer|Release|PlayAudio|SendDTMF (command 노드 전용)
	TargetURI     string        // MakeCall 대상 URI (command 노드 전용)
	FilePath      string        // PlayAudio WAV 파일 경로 (command 노드 전용)
	Digits        string        // SendDTMF 전송할 DTMF digit 문자열 (command 노드 전용)
	IntervalMs    float64       // SendDTMF digit 간 전송 간격 ms (command 노드 전용)
	Event         string        // INCOMING|DISCONNECTED|RINGING|TIMEOUT|DTMFReceived (event 노드 전용)
	ExpectedDigit string        // DTMFReceived 대기할 특정 digit (event 노드 전용)
	Timeout       time.Duration // 타임아웃 (기본 10초)
	SuccessNext   *GraphNode    // 성공 분기 다음 노드
	FailureNext   *GraphNode    // 실패 분기 다음 노드
	Data          map[string]interface{} // 원본 노드 데이터 (executePlayAudio에서 필요)
}

// SipInstanceConfig는 SIP Instance 설정
type SipInstanceConfig struct {
	ID       string
	Label    string
	Mode     string // DN|Endpoint
	DN       string
	Register bool
	Color    string
	Codecs   []string // ["PCMU", "PCMA"] — 사용자 선택 코덱 (우선순위 순서)
}

// InstanceChain은 인스턴스별 실행 체인
type InstanceChain struct {
	Config     SipInstanceConfig
	StartNodes []*GraphNode // 인스턴스 노드에서 직접 연결된 시작 노드들
}

// ExecutionGraph는 전체 실행 그래프
type ExecutionGraph struct {
	Instances map[string]*InstanceChain // instanceID -> 체인
	Nodes     map[string]*GraphNode     // nodeID -> 노드
}

// ParseScenario는 FlowData JSON 문자열을 ExecutionGraph로 변환한다
func ParseScenario(flowData string) (*ExecutionGraph, error) {
	var flow FlowData
	if err := json.Unmarshal([]byte(flowData), &flow); err != nil {
		return nil, fmt.Errorf("failed to unmarshal flowData: %w", err)
	}

	graph := &ExecutionGraph{
		Instances: make(map[string]*InstanceChain),
		Nodes:     make(map[string]*GraphNode),
	}

	// 1. sipInstance 노드를 SipInstanceConfig로 변환
	nodeTypeMap := make(map[string]string) // nodeID -> type (sipInstance|command|event)
	for _, node := range flow.Nodes {
		nodeTypeMap[node.ID] = node.Type

		if node.Type == "sipInstance" {
			config := SipInstanceConfig{
				ID:       node.ID,
				Label:    getStringField(node.Data, "label", ""),
				Mode:     getStringField(node.Data, "mode", "DN"),
				DN:       getStringField(node.Data, "dn", ""),
				Register: getBoolField(node.Data, "register", true),
				Color:    getStringField(node.Data, "color", ""),
				Codecs:   getStringArrayField(node.Data, "codecs", []string{"PCMU", "PCMA"}),
			}
			graph.Instances[node.ID] = &InstanceChain{
				Config:     config,
				StartNodes: []*GraphNode{},
			}
		}
	}

	// 2. command/event 노드를 GraphNode로 변환
	for _, node := range flow.Nodes {
		if node.Type == "command" || node.Type == "event" {
			sipInstanceID := getStringField(node.Data, "sipInstanceId", "")
			if sipInstanceID == "" {
				return nil, fmt.Errorf("node %s is missing sipInstanceId", node.ID)
			}
			if _, exists := graph.Instances[sipInstanceID]; !exists {
				return nil, fmt.Errorf("node %s references unknown instance %s", node.ID, sipInstanceID)
			}

			gnode := &GraphNode{
				ID:         node.ID,
				Type:       node.Type,
				InstanceID: sipInstanceID,
				Data:       node.Data, // 원본 데이터 저장
			}

			if node.Type == "command" {
				gnode.Command = getStringField(node.Data, "command", "")
				gnode.TargetURI = getStringField(node.Data, "targetUri", "")
				gnode.FilePath = getStringField(node.Data, "filePath", "")
				gnode.Digits = getStringField(node.Data, "digits", "")
				gnode.IntervalMs = getFloatField(node.Data, "intervalMs", 100)
				timeoutMs := getFloatField(node.Data, "timeout", 10000)
				gnode.Timeout = time.Duration(timeoutMs) * time.Millisecond
			} else if node.Type == "event" {
				gnode.Event = getStringField(node.Data, "event", "")
				gnode.ExpectedDigit = getStringField(node.Data, "expectedDigit", "")
				timeoutMs := getFloatField(node.Data, "timeout", 10000)
				gnode.Timeout = time.Duration(timeoutMs) * time.Millisecond
			}

			graph.Nodes[node.ID] = gnode
		}
	}

	// 3. 엣지를 순회하여 SuccessNext/FailureNext 설정 및 StartNodes 구축
	for _, edge := range flow.Edges {
		sourceType := nodeTypeMap[edge.Source]
		targetNode, targetExists := graph.Nodes[edge.Target]

		// failure 분기 판단
		isFailure := edge.SourceHandle == "failure"
		if !isFailure {
			// edge.Data의 branchType도 확인
			branchType := getStringField(edge.Data, "branchType", "")
			isFailure = branchType == "failure"
		}

		if sourceType == "sipInstance" {
			// sipInstance -> command/event: StartNodes에 추가
			if targetExists {
				instance := graph.Instances[edge.Source]
				instance.StartNodes = append(instance.StartNodes, targetNode)
			}
		} else if sourceType == "command" || sourceType == "event" {
			// command/event -> command/event: SuccessNext/FailureNext 설정
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

	// 4. 검증: 인스턴스가 0개이면 에러
	if len(graph.Instances) == 0 {
		return nil, fmt.Errorf("no sipInstance nodes found")
	}

	return graph, nil
}

// getStringField는 map[string]interface{}에서 안전하게 string 값을 추출한다
func getStringField(data map[string]interface{}, key, defaultVal string) string {
	if val, ok := data[key]; ok {
		if str, ok := val.(string); ok {
			return str
		}
	}
	return defaultVal
}

// getBoolField는 map[string]interface{}에서 안전하게 bool 값을 추출한다
func getBoolField(data map[string]interface{}, key string, defaultVal bool) bool {
	if val, ok := data[key]; ok {
		if b, ok := val.(bool); ok {
			return b
		}
	}
	return defaultVal
}

// getFloatField는 map[string]interface{}에서 안전하게 float64 값을 추출한다
func getFloatField(data map[string]interface{}, key string, defaultVal float64) float64 {
	if val, ok := data[key]; ok {
		if f, ok := val.(float64); ok {
			return f
		}
	}
	return defaultVal
}

// getStringArrayField는 map[string]interface{}에서 안전하게 []string 값을 추출한다
func getStringArrayField(data map[string]interface{}, key string, defaultVal []string) []string {
	if val, ok := data[key]; ok {
		if arr, ok := val.([]interface{}); ok {
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
