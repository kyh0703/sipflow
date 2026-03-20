package engine

import (
	"context"
	"encoding/json"
	"strings"
	"testing"
	"time"

	"github.com/emiago/diago"
	"github.com/emiago/sipgo/sip"
)

type stubRegisterTransaction struct{}

func (stubRegisterTransaction) Register(context.Context) error   { return nil }
func (stubRegisterTransaction) Unregister(context.Context) error { return nil }
func (stubRegisterTransaction) QualifyLoop(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

func TestParseScenario_SipInstanceRegisterConfig(t *testing.T) {
	flowJSON := `{
  "nodes": [
    {
      "id": "inst-a",
      "type": "sipInstance",
      "data": {
        "label": "4300",
        "dn": "4300",
        "register": true,
        "pbxHost": "pbx.local",
        "pbxPort": "5060",
        "pbxTransport": "UDP",
        "registerIntervalSeconds": 120
      }
    }
  ],
  "edges": []
}`

	graph, err := ParseScenario(flowJSON)
	if err != nil {
		t.Fatalf("ParseScenario failed: %v", err)
	}

	inst := graph.Instances["inst-a"]
	if inst == nil {
		t.Fatal("instance not found")
	}
	if inst.Config.PBXHost != "pbx.local" {
		t.Fatalf("expected pbx host, got %q", inst.Config.PBXHost)
	}
	if inst.Config.RegisterIntervalSeconds != 120 {
		t.Fatalf("expected register interval 120, got %d", inst.Config.RegisterIntervalSeconds)
	}
}

func TestBuildRegisterRecipient(t *testing.T) {
	recipient, opts, err := buildRegisterRecipient(SipInstanceConfig{
		DN:                      "4300",
		PBXHost:                 "pbx.local",
		PBXPort:                 "5060",
		RegisterIntervalSeconds: 90,
	})
	if err != nil {
		t.Fatalf("buildRegisterRecipient failed: %v", err)
	}

	if got := recipient.String(); !strings.Contains(got, "4300@pbx.local:5060") {
		t.Fatalf("unexpected recipient uri: %s", got)
	}
	if opts.Username != "4300" {
		t.Fatalf("expected username 4300, got %q", opts.Username)
	}
	if opts.Expiry != 90*time.Second {
		t.Fatalf("expected expiry 90s, got %v", opts.Expiry)
	}
	if opts.RetryInterval != 90*time.Second {
		t.Fatalf("expected retry 90s, got %v", opts.RetryInterval)
	}
}

func TestBuildRegisterRecipient_TCP(t *testing.T) {
	recipient, _, err := buildRegisterRecipient(SipInstanceConfig{
		DN:           "4300",
		PBXHost:      "pbx.local",
		PBXPort:      "5060",
		PBXTransport: "TCP",
	})
	if err != nil {
		t.Fatalf("buildRegisterRecipient failed: %v", err)
	}
	if got := recipient.String(); !strings.Contains(got, ";transport=tcp") {
		t.Fatalf("expected tcp transport in recipient uri, got %s", got)
	}
}

func TestStartScenario_RegisterOnlyWaitsUntilStopped(t *testing.T) {
	requireUDPNetworking(t)

	originalNewRegisterTransaction := newRegisterTransaction
	newRegisterTransaction = func(ctx context.Context, _ *diago.Diago, _ sip.Uri, _ diago.RegisterOptions) (registerTransaction, error) {
		return stubRegisterTransaction{}, nil
	}
	t.Cleanup(func() {
		newRegisterTransaction = originalNewRegisterTransaction
	})

	eng, repo, te := newTestEngine(t, 15220)

	nodes := []FlowNode{
		{
			ID:   "inst-a",
			Type: "sipInstance",
			Data: map[string]interface{}{
				"label":                   "4300",
				"dn":                      "4300",
				"register":                true,
				"pbxHost":                 "pbx.local",
				"pbxPort":                 "5060",
				"registerIntervalSeconds": 60.0,
			},
		},
	}

	flowData := buildTestFlowData(t, nodes, nil)
	scn, err := repo.CreateScenario("default", "register-only")
	if err != nil {
		t.Fatalf("CreateScenario failed: %v", err)
	}
	if err := repo.SaveScenario(scn.ID, flowData); err != nil {
		t.Fatalf("SaveScenario failed: %v", err)
	}

	if err := eng.StartScenario(scn.ID); err != nil {
		t.Fatalf("StartScenario failed: %v", err)
	}

	if !waitForEvent(t, te, EventStarted, 2*time.Second) {
		t.Fatal("expected started event")
	}

	time.Sleep(300 * time.Millisecond)
	if events := te.GetEventsByName(EventCompleted); len(events) > 0 {
		bytes, _ := json.Marshal(events)
		t.Fatalf("register-only scenario should not auto-complete before stop, got events: %s", string(bytes))
	}

	if err := eng.StopScenario(); err != nil {
		t.Fatalf("StopScenario failed: %v", err)
	}
}
