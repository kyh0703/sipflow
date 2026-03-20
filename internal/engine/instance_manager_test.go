package engine

import (
	"context"
	"net"
	"strconv"
	"syscall"
	"testing"
	"time"

	"github.com/emiago/diago"
	"github.com/emiago/diago/media"
)

func TestAllocatePort_Sequential(t *testing.T) {
	im := NewInstanceManager()
	// 테스트 환경에서 포트 충돌 방지를 위해 높은 포트 사용
	im.basePort = 15060
	im.nextPort = 15060

	// 첫 번째 포트 할당
	port1, err := im.allocatePort("udp", "127.0.0.1")
	if err != nil {
		t.Fatalf("Failed to allocate first port: %v", err)
	}
	if port1 != 15060 {
		t.Errorf("Expected first port to be 15060, got %d", port1)
	}

	// 두 번째 포트 할당 (15062 예상)
	port2, err := im.allocatePort("udp", "127.0.0.1")
	if err != nil {
		t.Fatalf("Failed to allocate second port: %v", err)
	}
	if port2 != 15062 {
		t.Errorf("Expected second port to be 15062, got %d", port2)
	}

	// 세 번째 포트 할당 (15064 예상)
	port3, err := im.allocatePort("udp", "127.0.0.1")
	if err != nil {
		t.Fatalf("Failed to allocate third port: %v", err)
	}
	if port3 != 15064 {
		t.Errorf("Expected third port to be 15064, got %d", port3)
	}

	// nextPort가 올바르게 업데이트되었는지 확인
	if im.nextPort != 15066 {
		t.Errorf("Expected nextPort to be 15066, got %d", im.nextPort)
	}
}

func TestAllocatePort_PermissionDeniedFallback(t *testing.T) {
	originalListenPacket := listenPacket
	listenPacket = func(network, address string) (net.PacketConn, error) {
		return nil, &net.OpError{
			Op:  "listen",
			Net: network,
			Err: syscall.EPERM,
		}
	}
	t.Cleanup(func() {
		listenPacket = originalListenPacket
	})

	im := NewInstanceManager()
	im.basePort = 15060
	im.nextPort = 15060

	port1, err := im.allocatePort("udp", "127.0.0.1")
	if err != nil {
		t.Fatalf("permission fallback should still allocate a port: %v", err)
	}
	if port1 != 15060 {
		t.Fatalf("expected fallback port 15060, got %d", port1)
	}

	port2, err := im.allocatePort("udp", "127.0.0.1")
	if err != nil {
		t.Fatalf("second permission fallback allocation failed: %v", err)
	}
	if port2 != 15062 {
		t.Fatalf("expected second fallback port 15062, got %d", port2)
	}
}

func TestAllocatePort_RetriesOnPortConflict(t *testing.T) {
	originalListenPacket := listenPacket
	attempts := 0
	listenPacket = func(network, address string) (net.PacketConn, error) {
		attempts++
		if attempts == 1 {
			return nil, &net.OpError{
				Op:  "listen",
				Net: network,
				Err: syscall.EADDRINUSE,
			}
		}
		return originalListenPacket(network, address)
	}
	t.Cleanup(func() {
		listenPacket = originalListenPacket
	})

	im := NewInstanceManager()
	im.basePort = 15110
	im.nextPort = 15110

	port, err := im.allocatePort("udp", "127.0.0.1")
	if err != nil {
		t.Fatalf("expected allocation after retry, got %v", err)
	}
	if port != 15112 {
		t.Fatalf("expected retry to move to 15112, got %d", port)
	}
}

func TestResolveBindHost(t *testing.T) {
	testCases := []struct {
		name     string
		config   SipInstanceConfig
		expected string
	}{
		{
			name:     "empty host uses loopback",
			config:   SipInstanceConfig{},
			expected: "127.0.0.1",
		},
		{
			name:     "localhost uses loopback",
			config:   SipInstanceConfig{PBXHost: "localhost"},
			expected: "127.0.0.1",
		},
		{
			name:     "loopback ip uses loopback",
			config:   SipInstanceConfig{PBXHost: "127.0.0.1"},
			expected: "127.0.0.1",
		},
		{
			name:     "external host uses wildcard bind",
			config:   SipInstanceConfig{PBXHost: "100.100.108.151"},
			expected: "0.0.0.0",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if got := resolveBindHost(tc.config); got != tc.expected {
				t.Fatalf("expected bind host %s, got %s", tc.expected, got)
			}
		})
	}
}

func TestCreateInstances_Basic(t *testing.T) {
	im := NewInstanceManager()
	// 테스트 환경에서 포트 충돌 방지를 위해 높은 포트 사용
	im.basePort = 15070
	im.nextPort = 15070

	// ExecutionGraph 생성 - 2개 인스턴스
	graph := &ExecutionGraph{
		Instances: map[string]*InstanceChain{
			"instance-a": {
				Config: SipInstanceConfig{
					ID:    "instance-a",
					Label: "Instance A",
					DN:    "100",
				},
				StartNodes: []*GraphNode{},
			},
			"instance-b": {
				Config: SipInstanceConfig{
					ID:    "instance-b",
					Label: "Instance B",
					DN:    "200",
				},
				StartNodes: []*GraphNode{},
			},
		},
		Nodes: map[string]*GraphNode{},
	}

	// 인스턴스 생성
	err := im.CreateInstances(graph)
	if err != nil {
		t.Fatalf("Failed to create instances: %v", err)
	}

	// 검증: 2개 인스턴스가 생성되었는지
	if len(im.instances) != 2 {
		t.Errorf("Expected 2 instances, got %d", len(im.instances))
	}

	// 검증: instance-a 존재
	instA, err := im.GetInstance("instance-a")
	if err != nil {
		t.Errorf("Instance A not found: %v", err)
	}
	if instA.Port != 15070 && instA.Port != 15072 {
		t.Logf("Instance A port: %d (expected 15070 or 15072)", instA.Port)
	}
	if instA.UA == nil {
		t.Error("Instance A UA is nil")
	}
	if instA.incomingCh == nil {
		t.Error("Instance A incomingCh is nil")
	}
	if cap(instA.incomingCh) != 4 {
		t.Errorf("Instance A incomingCh buffer expected 4, got %d", cap(instA.incomingCh))
	}

	// 검증: instance-b 존재
	instB, err := im.GetInstance("instance-b")
	if err != nil {
		t.Errorf("Instance B not found: %v", err)
	}
	if instB.Port != 15070 && instB.Port != 15072 {
		t.Logf("Instance B port: %d (expected 15070 or 15072)", instB.Port)
	}
	if instB.UA == nil {
		t.Error("Instance B UA is nil")
	}
	if im.dnToID["100"] != "instance-a" {
		t.Errorf("expected DN 100 to map to instance-a, got %q", im.dnToID["100"])
	}
	if im.dnToID["200"] != "instance-b" {
		t.Errorf("expected DN 200 to map to instance-b, got %q", im.dnToID["200"])
	}

	// 검증: 두 인스턴스가 다른 포트를 사용하는지
	if instA.Port == instB.Port {
		t.Errorf("Instances A and B have the same port: %d", instA.Port)
	}

	// 정리
	err = im.Cleanup()
	if err != nil {
		t.Errorf("Cleanup failed: %v", err)
	}
}

func TestManagedInstance_IncomingQueueFIFO(t *testing.T) {
	inst := &ManagedInstance{
		incomingCh: make(chan *diago.DialogServerSession, 4),
	}

	first := &diago.DialogServerSession{}
	second := &diago.DialogServerSession{}

	inst.incomingCh <- first
	inst.incomingCh <- second

	gotFirst := <-inst.incomingCh
	gotSecond := <-inst.incomingCh

	if gotFirst != first {
		t.Fatal("expected first queued dialog to be received first")
	}
	if gotSecond != second {
		t.Fatal("expected second queued dialog to be received second")
	}
}

func TestCleanup(t *testing.T) {
	im := NewInstanceManager()
	// 테스트 환경에서 포트 충돌 방지를 위해 높은 포트 사용
	im.basePort = 15080
	im.nextPort = 15080

	// ExecutionGraph 생성 - 1개 인스턴스
	graph := &ExecutionGraph{
		Instances: map[string]*InstanceChain{
			"instance-test": {
				Config: SipInstanceConfig{
					ID:    "instance-test",
					Label: "Test Instance",
					DN:    "300",
				},
				StartNodes: []*GraphNode{},
			},
		},
		Nodes: map[string]*GraphNode{},
	}

	// 인스턴스 생성
	err := im.CreateInstances(graph)
	if err != nil {
		t.Fatalf("Failed to create instances: %v", err)
	}

	// 생성 확인
	if len(im.instances) != 1 {
		t.Errorf("Expected 1 instance before cleanup, got %d", len(im.instances))
	}

	// Cleanup 호출
	err = im.Cleanup()
	if err != nil {
		t.Fatalf("Cleanup failed: %v", err)
	}

	// 검증: instances 맵이 비어있는지
	if len(im.instances) != 0 {
		t.Errorf("Expected 0 instances after cleanup, got %d", len(im.instances))
	}
	if len(im.dnToID) != 0 {
		t.Errorf("Expected 0 DN mappings after cleanup, got %d", len(im.dnToID))
	}

	// 검증: nextPort가 basePort로 리셋되었는지
	if im.nextPort != im.basePort {
		t.Errorf("Expected nextPort to be reset to basePort (%d), got %d", im.basePort, im.nextPort)
	}
}

func TestCleanup_ReleasesListenPort(t *testing.T) {
	im := NewInstanceManager()
	im.basePort = 15120
	im.nextPort = 15120

	graph := &ExecutionGraph{
		Instances: map[string]*InstanceChain{
			"instance-test": {
				Config: SipInstanceConfig{
					ID:    "instance-test",
					Label: "Test Instance",
					DN:    "301",
				},
				StartNodes: []*GraphNode{},
			},
		},
		Nodes: map[string]*GraphNode{},
	}

	if err := im.CreateInstances(graph); err != nil {
		t.Fatalf("Failed to create instances: %v", err)
	}

	inst, err := im.GetInstance("instance-test")
	if err != nil {
		t.Fatalf("Failed to get instance: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if err := im.StartServing(ctx); err != nil {
		t.Fatalf("Failed to start serving: %v", err)
	}

	addr := net.JoinHostPort("127.0.0.1", strconv.Itoa(inst.Port))
	deadline := time.Now().Add(2 * time.Second)
	for {
		conn, err := net.ListenPacket("udp", addr)
		if err != nil {
			break
		}
		_ = conn.Close()
		if time.Now().After(deadline) {
			t.Fatalf("port %d was not claimed by serve loop in time", inst.Port)
		}
		time.Sleep(20 * time.Millisecond)
	}

	if err := im.Cleanup(); err != nil {
		t.Fatalf("Cleanup failed: %v", err)
	}

	deadline = time.Now().Add(2 * time.Second)
	for {
		conn, err := net.ListenPacket("udp", addr)
		if err == nil {
			_ = conn.Close()
			return
		}
		if time.Now().After(deadline) {
			t.Fatalf("port %d was not released after cleanup: %v", inst.Port, err)
		}
		time.Sleep(20 * time.Millisecond)
	}
}

func TestGetInstance_NotFound(t *testing.T) {
	im := NewInstanceManager()

	// 존재하지 않는 인스턴스 조회
	_, err := im.GetInstance("non-existent")
	if err == nil {
		t.Error("Expected error for non-existent instance, got nil")
	}
}

func TestReset(t *testing.T) {
	im := NewInstanceManager()
	im.basePort = 15090
	im.nextPort = 15090

	// ExecutionGraph 생성
	graph := &ExecutionGraph{
		Instances: map[string]*InstanceChain{
			"instance-reset": {
				Config: SipInstanceConfig{
					ID:    "instance-reset",
					Label: "Reset Test",
					DN:    "400",
				},
				StartNodes: []*GraphNode{},
			},
		},
		Nodes: map[string]*GraphNode{},
	}

	// 인스턴스 생성
	err := im.CreateInstances(graph)
	if err != nil {
		t.Fatalf("Failed to create instances: %v", err)
	}

	// Reset 호출
	im.Reset()

	// 검증: instances 맵이 비어있는지
	if len(im.instances) != 0 {
		t.Errorf("Expected 0 instances after reset, got %d", len(im.instances))
	}

	// 검증: nextPort가 리셋되었는지
	if im.nextPort != im.basePort {
		t.Errorf("Expected nextPort to be reset to basePort (%d), got %d", im.basePort, im.nextPort)
	}
}

func TestResolveTarget_ByDN(t *testing.T) {
	im := NewInstanceManager()
	im.instances["instance-a"] = &ManagedInstance{
		Config: SipInstanceConfig{
			ID:    "instance-a",
			Label: "Instance A",
			DN:    "100",
		},
		Port: 15100,
	}
	im.dnToID["100"] = "instance-a"

	resolved, err := im.ResolveTarget("100")
	if err != nil {
		t.Fatalf("ResolveTarget failed: %v", err)
	}
	if resolved != "sip:100@127.0.0.1:15100" {
		t.Fatalf("expected resolved target sip:100@127.0.0.1:15100, got %s", resolved)
	}
}

func TestResolveTarget_ByDN_TCP(t *testing.T) {
	im := NewInstanceManager()
	im.instances["instance-a"] = &ManagedInstance{
		Config: SipInstanceConfig{
			ID:           "instance-a",
			Label:        "Instance A",
			DN:           "100",
			PBXTransport: "TCP",
		},
		Port: 15100,
	}
	im.dnToID["100"] = "instance-a"

	resolved, err := im.ResolveTarget("100")
	if err != nil {
		t.Fatalf("ResolveTarget failed: %v", err)
	}
	if resolved != "sip:100@127.0.0.1:15100;transport=tcp" {
		t.Fatalf("expected resolved target sip:100@127.0.0.1:15100;transport=tcp, got %s", resolved)
	}
}

func TestResolveTarget_BySIPURI(t *testing.T) {
	im := NewInstanceManager()

	resolved, err := im.ResolveTarget("sip:200@example.com")
	if err != nil {
		t.Fatalf("ResolveTarget should accept raw SIP URI: %v", err)
	}
	if resolved != "sip:200@example.com" {
		t.Fatalf("expected same SIP URI, got %s", resolved)
	}
}

func TestResolveTarget_DNNotFound(t *testing.T) {
	im := NewInstanceManager()

	_, err := im.ResolveTarget("999")
	if err == nil {
		t.Fatal("expected error for unknown DN")
	}
}

func TestCreateInstances_DuplicateDN(t *testing.T) {
	im := NewInstanceManager()

	graph := &ExecutionGraph{
		Instances: map[string]*InstanceChain{
			"instance-a": {
				Config: SipInstanceConfig{ID: "instance-a", DN: "100"},
			},
			"instance-b": {
				Config: SipInstanceConfig{ID: "instance-b", DN: "100"},
			},
		},
		Nodes: map[string]*GraphNode{},
	}

	err := im.CreateInstances(graph)
	if err == nil {
		t.Fatal("expected duplicate DN error")
	}
}

// TestStringToCodecs는 stringToCodecs 함수의 코덱 변환을 테스트한다
func TestStringToCodecs(t *testing.T) {
	tests := []struct {
		name         string
		input        []string
		expectedLen  int
		lastIsTelEvt bool
	}{
		{"PCMU and PCMA", []string{"PCMU", "PCMA"}, 3, true},
		{"PCMU only", []string{"PCMU"}, 2, true},
		{"empty", []string{}, 1, true},
		{"invalid codec ignored", []string{"INVALID", "PCMU"}, 2, true},
		{"all invalid", []string{"INVALID", "UNKNOWN"}, 1, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := stringToCodecs(tt.input)
			if len(result) != tt.expectedLen {
				t.Errorf("stringToCodecs(%v): expected %d codecs, got %d", tt.input, tt.expectedLen, len(result))
			}
			if tt.lastIsTelEvt && len(result) > 0 {
				last := result[len(result)-1]
				if last != media.CodecTelephoneEvent8000 {
					t.Errorf("stringToCodecs(%v): last codec should be CodecTelephoneEvent8000", tt.input)
				}
			}
		})
	}
}
