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

// TestParseScenario_PlayAudioFields tests PlayAudio command field parsing
func TestParseScenario_PlayAudioFields(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100"
      }
    },
    {
      "id": "cmd-1",
      "type": "command",
      "position": {"x": 100, "y": 250},
      "data": {
        "command": "PlayAudio",
        "sipInstanceId": "inst-a",
        "filePath": "/path/to/audio.wav"
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

	graph, err := ParseScenario(flowJSON)
	if err != nil {
		t.Fatalf("ParseScenario failed: %v", err)
	}

	cmd1 := graph.Nodes["cmd-1"]
	if cmd1 == nil {
		t.Fatal("cmd-1 not found")
	}

	// 검증: Command == "PlayAudio"
	if cmd1.Command != "PlayAudio" {
		t.Errorf("expected command 'PlayAudio', got '%s'", cmd1.Command)
	}

	// 검증: FilePath 파싱됨
	if cmd1.FilePath != "/path/to/audio.wav" {
		t.Errorf("expected filePath '/path/to/audio.wav', got '%s'", cmd1.FilePath)
	}
}

// TestParseScenario_SendDTMFFields tests SendDTMF command field parsing
func TestParseScenario_SendDTMFFields(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100"
      }
    },
    {
      "id": "cmd-1",
      "type": "command",
      "position": {"x": 100, "y": 250},
      "data": {
        "command": "SendDTMF",
        "sipInstanceId": "inst-a",
        "digits": "123*#",
        "intervalMs": 200
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

	graph, err := ParseScenario(flowJSON)
	if err != nil {
		t.Fatalf("ParseScenario failed: %v", err)
	}

	cmd1 := graph.Nodes["cmd-1"]
	if cmd1 == nil {
		t.Fatal("cmd-1 not found")
	}

	// 검증: Command == "SendDTMF"
	if cmd1.Command != "SendDTMF" {
		t.Errorf("expected command 'SendDTMF', got '%s'", cmd1.Command)
	}

	// 검증: Digits 파싱됨
	if cmd1.Digits != "123*#" {
		t.Errorf("expected digits '123*#', got '%s'", cmd1.Digits)
	}

	// 검증: IntervalMs 파싱됨
	if cmd1.IntervalMs != 200 {
		t.Errorf("expected intervalMs 200, got %f", cmd1.IntervalMs)
	}
}

// TestParseScenario_SendDTMFDefaults tests SendDTMF default intervalMs
func TestParseScenario_SendDTMFDefaults(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100"
      }
    },
    {
      "id": "cmd-1",
      "type": "command",
      "position": {"x": 100, "y": 250},
      "data": {
        "command": "SendDTMF",
        "sipInstanceId": "inst-a",
        "digits": "1"
      }
    }
  ],
  "edges": []
}`

	graph, err := ParseScenario(flowJSON)
	if err != nil {
		t.Fatalf("ParseScenario failed: %v", err)
	}

	cmd1 := graph.Nodes["cmd-1"]
	if cmd1 == nil {
		t.Fatal("cmd-1 not found")
	}

	// 검증: IntervalMs 기본값 100
	if cmd1.IntervalMs != 100 {
		t.Errorf("expected default intervalMs 100, got %f", cmd1.IntervalMs)
	}
}

// TestParseScenario_DTMFReceivedFields tests DTMFReceived event field parsing
func TestParseScenario_DTMFReceivedFields(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100"
      }
    },
    {
      "id": "evt-1",
      "type": "event",
      "position": {"x": 100, "y": 250},
      "data": {
        "event": "DTMFReceived",
        "sipInstanceId": "inst-a",
        "expectedDigit": "5"
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

	// 검증: Event == "DTMFReceived"
	if evt1.Event != "DTMFReceived" {
		t.Errorf("expected event 'DTMFReceived', got '%s'", evt1.Event)
	}

	// 검증: ExpectedDigit 파싱됨
	if evt1.ExpectedDigit != "5" {
		t.Errorf("expected expectedDigit '5', got '%s'", evt1.ExpectedDigit)
	}
}

// TestParseScenario_DTMFReceivedNoExpectedDigit tests DTMFReceived without expectedDigit
func TestParseScenario_DTMFReceivedNoExpectedDigit(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100"
      }
    },
    {
      "id": "evt-1",
      "type": "event",
      "position": {"x": 100, "y": 250},
      "data": {
        "event": "DTMFReceived",
        "sipInstanceId": "inst-a"
      }
    }
  ],
  "edges": []
}`

	graph, err := ParseScenario(flowJSON)
	if err != nil {
		t.Fatalf("ParseScenario failed: %v", err)
	}

	evt1 := graph.Nodes["evt-1"]
	if evt1 == nil {
		t.Fatal("evt-1 not found")
	}

	// 검증: ExpectedDigit는 빈 문자열 (기본값)
	if evt1.ExpectedDigit != "" {
		t.Errorf("expected empty expectedDigit, got '%s'", evt1.ExpectedDigit)
	}
}

// TestParseScenario_BlindTransferFields tests BlindTransfer command field parsing
func TestParseScenario_BlindTransferFields(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100"
      }
    },
    {
      "id": "cmd-1",
      "type": "command",
      "position": {"x": 100, "y": 250},
      "data": {
        "command": "BlindTransfer",
        "sipInstanceId": "inst-a",
        "targetUser": "carol",
        "targetHost": "192.168.1.100:5060"
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

	graph, err := ParseScenario(flowJSON)
	if err != nil {
		t.Fatalf("ParseScenario failed: %v", err)
	}

	cmd1 := graph.Nodes["cmd-1"]
	if cmd1 == nil {
		t.Fatal("cmd-1 not found")
	}

	// 검증: Command == "BlindTransfer"
	if cmd1.Command != "BlindTransfer" {
		t.Errorf("expected command 'BlindTransfer', got '%s'", cmd1.Command)
	}

	// 검증: TargetUser 파싱됨
	if cmd1.TargetUser != "carol" {
		t.Errorf("expected targetUser 'carol', got '%s'", cmd1.TargetUser)
	}

	// 검증: TargetHost 파싱됨
	if cmd1.TargetHost != "192.168.1.100:5060" {
		t.Errorf("expected targetHost '192.168.1.100:5060', got '%s'", cmd1.TargetHost)
	}
}

// TestParseScenario_HoldFields tests Hold command field parsing (NF-01)
func TestParseScenario_HoldFields(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100"
      }
    },
    {
      "id": "cmd-1",
      "type": "command",
      "position": {"x": 100, "y": 250},
      "data": {
        "command": "Hold",
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

	// 검증: Command == "Hold"
	if cmd1.Command != "Hold" {
		t.Errorf("expected command 'Hold', got '%s'", cmd1.Command)
	}

	// 검증: TargetUser는 빈 문자열 (Hold는 target 파라미터 없음)
	if cmd1.TargetUser != "" {
		t.Errorf("expected empty targetUser for Hold, got '%s'", cmd1.TargetUser)
	}

	// 검증: TargetHost는 빈 문자열 (Hold는 target 파라미터 없음)
	if cmd1.TargetHost != "" {
		t.Errorf("expected empty targetHost for Hold, got '%s'", cmd1.TargetHost)
	}
}

// TestParseScenario_RetrieveFields tests Retrieve command field parsing (NF-01)
func TestParseScenario_RetrieveFields(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100"
      }
    },
    {
      "id": "cmd-1",
      "type": "command",
      "position": {"x": 100, "y": 250},
      "data": {
        "command": "Retrieve",
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

	// 검증: Command == "Retrieve"
	if cmd1.Command != "Retrieve" {
		t.Errorf("expected command 'Retrieve', got '%s'", cmd1.Command)
	}

	// 검증: TargetUser는 빈 문자열 (Retrieve는 target 파라미터 없음)
	if cmd1.TargetUser != "" {
		t.Errorf("expected empty targetUser for Retrieve, got '%s'", cmd1.TargetUser)
	}
}

// TestParseScenario_V1_1_BackwardCompatibility tests that v1.1 scenario format
// parses successfully with v1.2 parser without breaking (NF-02)
func TestParseScenario_V1_1_BackwardCompatibility(t *testing.T) {
	// v1.1 시나리오 시뮬레이션: targetUser, targetHost, codecs 등 v1.2 신규 필드가 누락된 상태
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "position": {"x": 100, "y": 100},
      "data": {
        "label": "Instance A",
        "mode": "DN",
        "dn": "100"
      }
    },
    {
      "id": "inst-b",
      "type": "sipInstance",
      "position": {"x": 400, "y": 100},
      "data": {
        "label": "Instance B",
        "mode": "DN",
        "dn": "200"
      }
    },
    {
      "id": "cmd-makecall",
      "type": "command",
      "position": {"x": 100, "y": 250},
      "data": {
        "command": "MakeCall",
        "sipInstanceId": "inst-a",
        "targetUri": "sip:200@127.0.0.1:5062"
      }
    },
    {
      "id": "evt-incoming",
      "type": "event",
      "position": {"x": 400, "y": 250},
      "data": {
        "event": "INCOMING",
        "sipInstanceId": "inst-b"
      }
    },
    {
      "id": "cmd-answer",
      "type": "command",
      "position": {"x": 400, "y": 400},
      "data": {
        "command": "Answer",
        "sipInstanceId": "inst-b"
      }
    },
    {
      "id": "cmd-playaudio",
      "type": "command",
      "position": {"x": 100, "y": 400},
      "data": {
        "command": "PlayAudio",
        "sipInstanceId": "inst-a",
        "filePath": "/audio/greeting.wav"
      }
    },
    {
      "id": "cmd-senddtmf",
      "type": "command",
      "position": {"x": 100, "y": 550},
      "data": {
        "command": "SendDTMF",
        "sipInstanceId": "inst-a",
        "digits": "9",
        "intervalMs": 150
      }
    },
    {
      "id": "evt-dtmf",
      "type": "event",
      "position": {"x": 400, "y": 550},
      "data": {
        "event": "DTMFReceived",
        "sipInstanceId": "inst-b",
        "expectedDigit": "9"
      }
    },
    {
      "id": "cmd-release",
      "type": "command",
      "position": {"x": 100, "y": 700},
      "data": {
        "command": "Release",
        "sipInstanceId": "inst-a"
      }
    },
    {
      "id": "evt-disconnected",
      "type": "event",
      "position": {"x": 400, "y": 700},
      "data": {
        "event": "DISCONNECTED",
        "sipInstanceId": "inst-b"
      }
    }
  ],
  "edges": [
    {"id": "e1", "source": "inst-a", "target": "cmd-makecall", "sourceHandle": "success"},
    {"id": "e2", "source": "inst-b", "target": "evt-incoming", "sourceHandle": "success"},
    {"id": "e3", "source": "cmd-makecall", "target": "cmd-playaudio", "sourceHandle": "success"},
    {"id": "e4", "source": "evt-incoming", "target": "cmd-answer", "sourceHandle": "success"},
    {"id": "e5", "source": "cmd-playaudio", "target": "cmd-senddtmf", "sourceHandle": "success"},
    {"id": "e6", "source": "cmd-answer", "target": "evt-dtmf", "sourceHandle": "success"},
    {"id": "e7", "source": "cmd-senddtmf", "target": "cmd-release", "sourceHandle": "success"},
    {"id": "e8", "source": "evt-dtmf", "target": "evt-disconnected", "sourceHandle": "success"}
  ]
}`

	// 검증: v1.1 시나리오가 v1.2 파서에서 에러 없이 파싱됨
	graph, err := ParseScenario(flowJSON)
	if err != nil {
		t.Fatalf("v1.1 backward compatibility broken — ParseScenario failed: %v", err)
	}

	// 검증: 인스턴스 2개 존재
	if len(graph.Instances) != 2 {
		t.Errorf("expected 2 instances, got %d", len(graph.Instances))
	}

	// 검증: MakeCall의 TargetURI가 올바르게 파싱됨
	cmdMakeCall := graph.Nodes["cmd-makecall"]
	if cmdMakeCall == nil {
		t.Fatal("cmd-makecall not found")
	}
	if cmdMakeCall.TargetURI != "sip:200@127.0.0.1:5062" {
		t.Errorf("expected targetUri 'sip:200@127.0.0.1:5062', got '%s'", cmdMakeCall.TargetURI)
	}

	// 검증: PlayAudio의 FilePath가 올바르게 파싱됨
	cmdPlayAudio := graph.Nodes["cmd-playaudio"]
	if cmdPlayAudio == nil {
		t.Fatal("cmd-playaudio not found")
	}
	if cmdPlayAudio.FilePath != "/audio/greeting.wav" {
		t.Errorf("expected filePath '/audio/greeting.wav', got '%s'", cmdPlayAudio.FilePath)
	}

	// 검증: SendDTMF의 Digits, IntervalMs가 올바르게 파싱됨
	cmdSendDTMF := graph.Nodes["cmd-senddtmf"]
	if cmdSendDTMF == nil {
		t.Fatal("cmd-senddtmf not found")
	}
	if cmdSendDTMF.Digits != "9" {
		t.Errorf("expected digits '9', got '%s'", cmdSendDTMF.Digits)
	}
	if cmdSendDTMF.IntervalMs != 150 {
		t.Errorf("expected intervalMs 150, got %f", cmdSendDTMF.IntervalMs)
	}

	// 검증: DTMFReceived의 ExpectedDigit가 올바르게 파싱됨
	evtDTMF := graph.Nodes["evt-dtmf"]
	if evtDTMF == nil {
		t.Fatal("evt-dtmf not found")
	}
	if evtDTMF.ExpectedDigit != "9" {
		t.Errorf("expected expectedDigit '9', got '%s'", evtDTMF.ExpectedDigit)
	}

	// 검증: v1.2 신규 필드(TargetUser, TargetHost)는 빈 문자열 기본값 (getStringField 하위 호환성)
	if cmdMakeCall.TargetUser != "" {
		t.Errorf("expected empty TargetUser for v1.1 MakeCall node, got '%s'", cmdMakeCall.TargetUser)
	}
	if cmdMakeCall.TargetHost != "" {
		t.Errorf("expected empty TargetHost for v1.1 MakeCall node, got '%s'", cmdMakeCall.TargetHost)
	}
}
