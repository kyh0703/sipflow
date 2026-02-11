package engine

import (
	"testing"
	"time"
)

// TestParseScenario_BasicTwoInstance tests 2-instance scenario with MakeCall + Incoming + Answer
func TestParseScenario_BasicTwoInstance(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100",
        "register": true,
        "color": "#3b82f6"
      }
    },
    {
      "id": "inst-b",
      "type": "sipInstance",
      "position": {"x": 400, "y": 100},
      "data": {
        "label": "Instance B",
        "mode": "DN",
        "dn": "200",
        "register": true,
        "color": "#ef4444"
      }
    },
    {
      "id": "cmd-1",
      "type": "command",
      "position": {"x": 100, "y": 250},
      "data": {
        "command": "MakeCall",
        "sipInstanceId": "inst-a",
        "targetUri": "sip:200@127.0.0.1:5062"
      }
    },
    {
      "id": "evt-1",
      "type": "event",
      "position": {"x": 400, "y": 250},
      "data": {
        "event": "INCOMING",
        "sipInstanceId": "inst-b"
      }
    },
    {
      "id": "cmd-2",
      "type": "command",
      "position": {"x": 400, "y": 400},
      "data": {
        "command": "Answer",
        "sipInstanceId": "inst-b"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "inst-a",
      "target": "cmd-1",
      "sourceHandle": "success"
    },
    {
      "id": "edge-2",
      "source": "inst-b",
      "target": "evt-1",
      "sourceHandle": "success"
    },
    {
      "id": "edge-3",
      "source": "evt-1",
      "target": "cmd-2",
      "sourceHandle": "success"
    }
  ]
}`

	graph, err := ParseScenario(flowJSON)
	if err != nil {
		t.Fatalf("ParseScenario failed: %v", err)
	}

	// 검증: 인스턴스 2개 파싱됨
	if len(graph.Instances) != 2 {
		t.Errorf("expected 2 instances, got %d", len(graph.Instances))
	}

	// 검증: inst-a의 StartNodes에 cmd-1 포함
	instA, ok := graph.Instances["inst-a"]
	if !ok {
		t.Fatal("inst-a not found in graph.Instances")
	}
	if len(instA.StartNodes) != 1 {
		t.Errorf("inst-a: expected 1 start node, got %d", len(instA.StartNodes))
	}
	if instA.StartNodes[0].ID != "cmd-1" {
		t.Errorf("inst-a: expected start node cmd-1, got %s", instA.StartNodes[0].ID)
	}

	// 검증: inst-b의 StartNodes에 evt-1 포함
	instB, ok := graph.Instances["inst-b"]
	if !ok {
		t.Fatal("inst-b not found in graph.Instances")
	}
	if len(instB.StartNodes) != 1 {
		t.Errorf("inst-b: expected 1 start node, got %d", len(instB.StartNodes))
	}
	if instB.StartNodes[0].ID != "evt-1" {
		t.Errorf("inst-b: expected start node evt-1, got %s", instB.StartNodes[0].ID)
	}

	// 검증: cmd-1의 SuccessNext 없음
	cmd1 := graph.Nodes["cmd-1"]
	if cmd1 == nil {
		t.Fatal("cmd-1 not found in graph.Nodes")
	}
	if cmd1.SuccessNext != nil {
		t.Errorf("cmd-1: expected no SuccessNext, got %s", cmd1.SuccessNext.ID)
	}

	// 검증: evt-1의 SuccessNext == cmd-2
	evt1 := graph.Nodes["evt-1"]
	if evt1 == nil {
		t.Fatal("evt-1 not found in graph.Nodes")
	}
	if evt1.SuccessNext == nil {
		t.Fatal("evt-1: expected SuccessNext, got nil")
	}
	if evt1.SuccessNext.ID != "cmd-2" {
		t.Errorf("evt-1: expected SuccessNext cmd-2, got %s", evt1.SuccessNext.ID)
	}

	// 검증: evt-1의 Timeout == 10초 (기본값)
	if evt1.Timeout != 10*time.Second {
		t.Errorf("evt-1: expected timeout 10s, got %v", evt1.Timeout)
	}
}

// TestParseScenario_FailureBranch tests failure branch handling
func TestParseScenario_FailureBranch(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100",
        "register": true
      }
    },
    {
      "id": "cmd-1",
      "type": "command",
      "position": {"x": 100, "y": 250},
      "data": {
        "command": "MakeCall",
        "sipInstanceId": "inst-a",
        "targetUri": "sip:200@127.0.0.1:5062"
      }
    },
    {
      "id": "cmd-success",
      "type": "command",
      "position": {"x": 100, "y": 400},
      "data": {
        "command": "Release",
        "sipInstanceId": "inst-a"
      }
    },
    {
      "id": "cmd-failure",
      "type": "command",
      "position": {"x": 300, "y": 400},
      "data": {
        "command": "Release",
        "sipInstanceId": "inst-a"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "inst-a",
      "target": "cmd-1",
      "sourceHandle": "success"
    },
    {
      "id": "edge-success",
      "source": "cmd-1",
      "target": "cmd-success",
      "sourceHandle": "success",
      "data": {"branchType": "success"}
    },
    {
      "id": "edge-failure",
      "source": "cmd-1",
      "target": "cmd-failure",
      "sourceHandle": "failure",
      "data": {"branchType": "failure"}
    }
  ]
}`

	graph, err := ParseScenario(flowJSON)
	if err != nil {
		t.Fatalf("ParseScenario failed: %v", err)
	}

	cmd1 := graph.Nodes["cmd-1"]
	if cmd1 == nil {
		t.Fatal("cmd-1 not found")
	}

	// 검증: SuccessNext 설정됨
	if cmd1.SuccessNext == nil {
		t.Fatal("cmd-1: expected SuccessNext, got nil")
	}
	if cmd1.SuccessNext.ID != "cmd-success" {
		t.Errorf("cmd-1: expected SuccessNext cmd-success, got %s", cmd1.SuccessNext.ID)
	}

	// 검증: FailureNext 설정됨
	if cmd1.FailureNext == nil {
		t.Fatal("cmd-1: expected FailureNext, got nil")
	}
	if cmd1.FailureNext.ID != "cmd-failure" {
		t.Errorf("cmd-1: expected FailureNext cmd-failure, got %s", cmd1.FailureNext.ID)
	}
}

// TestParseScenario_CustomTimeout tests custom timeout configuration
func TestParseScenario_CustomTimeout(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100",
        "register": true
      }
    },
    {
      "id": "evt-1",
      "type": "event",
      "position": {"x": 100, "y": 250},
      "data": {
        "event": "INCOMING",
        "sipInstanceId": "inst-a",
        "timeout": 5000
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "inst-a",
      "target": "evt-1",
      "sourceHandle": "success"
    }
  ]
}`

	graph, err := ParseScenario(flowJSON)
	if err != nil {
		t.Fatalf("ParseScenario failed: %v", err)
	}

	evt1 := graph.Nodes["evt-1"]
	if evt1 == nil {
		t.Fatal("evt-1 not found")
	}

	// 검증: Timeout == 5초
	if evt1.Timeout != 5*time.Second {
		t.Errorf("evt-1: expected timeout 5s, got %v", evt1.Timeout)
	}
}

// TestParseScenario_EmptyFlowData tests empty JSON input
func TestParseScenario_EmptyFlowData(t *testing.T) {
	flowJSON := `{}`

	_, err := ParseScenario(flowJSON)
	if err == nil {
		t.Fatal("expected error for empty flowData, got nil")
	}

	// 검증: 에러 메시지에 "no sipInstance" 포함
	expectedMsg := "no sipInstance"
	if err.Error()[:len(expectedMsg)] != expectedMsg {
		t.Errorf("expected error message starting with '%s', got '%s'", expectedMsg, err.Error())
	}
}

// TestParseScenario_MissingInstanceId tests missing sipInstanceId
func TestParseScenario_MissingInstanceId(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100",
        "register": true
      }
    },
    {
      "id": "cmd-1",
      "type": "command",
      "position": {"x": 100, "y": 250},
      "data": {
        "command": "MakeCall",
        "targetUri": "sip:200@127.0.0.1:5062"
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source": "inst-a",
      "target": "cmd-1",
      "sourceHandle": "success"
    }
  ]
}`

	_, err := ParseScenario(flowJSON)
	if err == nil {
		t.Fatal("expected error for missing sipInstanceId, got nil")
	}

	// 검증: 에러 메시지에 "missing sipInstanceId" 포함
	expectedMsg := "missing sipInstanceId"
	if len(err.Error()) < len(expectedMsg) || err.Error()[len(err.Error())-len(expectedMsg):] != expectedMsg {
		t.Errorf("expected error message containing '%s', got '%s'", expectedMsg, err.Error())
	}
}

// TestParseScenario_CodecsField tests codecs field parsing
func TestParseScenario_CodecsField(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100",
        "register": true,
        "codecs": ["PCMA", "PCMU"]
      }
    }
  ],
  "edges": []
}`

	graph, err := ParseScenario(flowJSON)
	if err != nil {
		t.Fatalf("ParseScenario failed: %v", err)
	}

	instA, ok := graph.Instances["inst-a"]
	if !ok {
		t.Fatal("inst-a not found")
	}

	// 검증: Codecs 필드가 순서대로 파싱됨
	expectedCodecs := []string{"PCMA", "PCMU"}
	if len(instA.Config.Codecs) != len(expectedCodecs) {
		t.Errorf("expected %d codecs, got %d", len(expectedCodecs), len(instA.Config.Codecs))
	}
	for i, codec := range expectedCodecs {
		if instA.Config.Codecs[i] != codec {
			t.Errorf("codec[%d]: expected %s, got %s", i, codec, instA.Config.Codecs[i])
		}
	}
}

// TestParseScenario_CodecsDefault tests default codecs when field is missing
func TestParseScenario_CodecsDefault(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100",
        "register": true
      }
    }
  ],
  "edges": []
}`

	graph, err := ParseScenario(flowJSON)
	if err != nil {
		t.Fatalf("ParseScenario failed: %v", err)
	}

	instA, ok := graph.Instances["inst-a"]
	if !ok {
		t.Fatal("inst-a not found")
	}

	// 검증: 기본값 ["PCMU", "PCMA"] 적용
	expectedCodecs := []string{"PCMU", "PCMA"}
	if len(instA.Config.Codecs) != len(expectedCodecs) {
		t.Errorf("expected %d codecs, got %d", len(expectedCodecs), len(instA.Config.Codecs))
	}
	for i, codec := range expectedCodecs {
		if instA.Config.Codecs[i] != codec {
			t.Errorf("codec[%d]: expected %s, got %s", i, codec, instA.Config.Codecs[i])
		}
	}
}

// TestParseScenario_CodecsEmpty tests empty codecs array fallback to default
func TestParseScenario_CodecsEmpty(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100",
        "register": true,
        "codecs": []
      }
    }
  ],
  "edges": []
}`

	graph, err := ParseScenario(flowJSON)
	if err != nil {
		t.Fatalf("ParseScenario failed: %v", err)
	}

	instA, ok := graph.Instances["inst-a"]
	if !ok {
		t.Fatal("inst-a not found")
	}

	// 검증: 빈 배열일 때 기본값 ["PCMU", "PCMA"]로 폴백
	expectedCodecs := []string{"PCMU", "PCMA"}
	if len(instA.Config.Codecs) != len(expectedCodecs) {
		t.Errorf("expected %d codecs, got %d", len(expectedCodecs), len(instA.Config.Codecs))
	}
	for i, codec := range expectedCodecs {
		if instA.Config.Codecs[i] != codec {
			t.Errorf("codec[%d]: expected %s, got %s", i, codec, instA.Config.Codecs[i])
		}
	}
}

// TestParseScenario_CodecsInvalid tests that invalid codec names are preserved during parsing
func TestParseScenario_CodecsInvalid(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100",
        "register": true,
        "codecs": ["INVALID", "PCMU"]
      }
    }
  ],
  "edges": []
}`

	graph, err := ParseScenario(flowJSON)
	if err != nil {
		t.Fatalf("ParseScenario failed: %v", err)
	}

	instA, ok := graph.Instances["inst-a"]
	if !ok {
		t.Fatal("inst-a not found")
	}

	// 검증: 잘못된 코덱 이름도 파싱 단계에서는 원본 보존 (필터링은 stringToCodecs에서)
	expectedCodecs := []string{"INVALID", "PCMU"}
	if len(instA.Config.Codecs) != len(expectedCodecs) {
		t.Errorf("expected %d codecs, got %d", len(expectedCodecs), len(instA.Config.Codecs))
	}
	for i, codec := range expectedCodecs {
		if instA.Config.Codecs[i] != codec {
			t.Errorf("codec[%d]: expected %s, got %s", i, codec, instA.Config.Codecs[i])
		}
	}
}
