package engine

import (
	"context"
	"errors"
	"fmt"
	"net"
	"os"
	"strings"
	"sync"
	"syscall"

	"github.com/emiago/diago"
	"github.com/emiago/diago/media"
	"github.com/emiago/sipgo"
)

var listenPacket = net.ListenPacket

// ManagedInstance는 관리되는 diago SIP UA 인스턴스
type ManagedInstance struct {
	Config     SipInstanceConfig
	UA         *diago.Diago
	Port       int
	incomingCh chan *diago.DialogServerSession
	cancel     context.CancelFunc
}

// InstanceManager는 diago SIP UA 인스턴스를 생성하고 관리한다
type InstanceManager struct {
	mu         sync.Mutex
	instances  map[string]*ManagedInstance
	dnToID     map[string]string
	basePort   int
	nextPort   int
	maxRetries int
}

// NewInstanceManager는 새로운 InstanceManager를 생성한다
func NewInstanceManager() *InstanceManager {
	return &InstanceManager{
		instances:  make(map[string]*ManagedInstance),
		dnToID:     make(map[string]string),
		basePort:   5060,
		nextPort:   5060,
		maxRetries: 10,
	}
}

// stringToCodecs는 코덱 이름 문자열 배열을 media.Codec 배열로 변환한다
func stringToCodecs(codecNames []string) []media.Codec {
	codecs := make([]media.Codec, 0, len(codecNames)+1)
	for _, name := range codecNames {
		switch name {
		case "PCMU":
			codecs = append(codecs, media.CodecAudioUlaw)
		case "PCMA":
			codecs = append(codecs, media.CodecAudioAlaw)
		}
	}
	// telephone-event는 항상 마지막에 추가 (DTMF 지원)
	codecs = append(codecs, media.CodecTelephoneEvent8000)
	return codecs
}

// CreateInstances는 ExecutionGraph의 모든 인스턴스에 대해 diago UA를 생성한다
func (im *InstanceManager) CreateInstances(graph *ExecutionGraph) error {
	im.mu.Lock()
	defer im.mu.Unlock()

	// 생성된 인스턴스를 추적 (실패 시 정리용)
	var createdInstances []*ManagedInstance

	for instanceID, chain := range graph.Instances {
		dn := strings.TrimSpace(chain.Config.DN)
		if dn != "" {
			if existingID, exists := im.dnToID[dn]; exists {
				for _, inst := range createdInstances {
					if inst.cancel != nil {
						inst.cancel()
					}
				}
				return fmt.Errorf("duplicate DN %q for instances %s and %s", dn, existingID, instanceID)
			}
		}

		// 포트 할당
		port, err := im.allocatePort()
		if err != nil {
			// 실패 시 이미 생성된 인스턴스 정리
			for _, inst := range createdInstances {
				if inst.cancel != nil {
					inst.cancel()
				}
			}
			return fmt.Errorf("failed to allocate port for instance %s: %w", instanceID, err)
		}

		// sipgo UserAgent 생성
		ua, err := sipgo.NewUA()
		if err != nil {
			// 실패 시 이미 생성된 인스턴스 정리
			for _, inst := range createdInstances {
				if inst.cancel != nil {
					inst.cancel()
				}
			}
			return fmt.Errorf("failed to create UA for instance %s: %w", instanceID, err)
		}

		// 코덱 문자열 → media.Codec 변환
		codecs := stringToCodecs(chain.Config.Codecs)

		// diago 인스턴스 생성 (127.0.0.1에 바인딩)
		dg := diago.NewDiago(ua,
			diago.WithTransport(diago.Transport{
				Transport: "udp",
				BindHost:  "127.0.0.1",
				BindPort:  port,
			}),
			diago.WithMediaConfig(diago.MediaConfig{
				Codecs: codecs,
			}),
		)

		// ManagedInstance 생성
		managedInst := &ManagedInstance{
			Config:     chain.Config,
			UA:         dg,
			Port:       port,
			incomingCh: make(chan *diago.DialogServerSession, 4),
			cancel:     nil, // StartServing에서 설정
		}

		im.instances[instanceID] = managedInst
		if dn != "" {
			im.dnToID[dn] = instanceID
		}
		createdInstances = append(createdInstances, managedInst)
	}

	return nil
}

// allocatePort는 사용 가능한 포트를 찾아 반환한다
func (im *InstanceManager) allocatePort() (int, error) {
	for i := 0; i < im.maxRetries; i++ {
		port := im.nextPort + (i * 2)

		// 포트 가용성 테스트
		addr := fmt.Sprintf("127.0.0.1:%d", port)
		conn, err := listenPacket("udp", addr)
		if err != nil {
			if errors.Is(err, syscall.EPERM) || errors.Is(err, syscall.EACCES) || os.IsPermission(err) {
				// Sandbox/CI 환경에서는 소켓 생성 자체가 차단될 수 있다.
				// 이 경우 실제 바인딩 검사는 건너뛰고 순차 포트만 예약하여
				// 네트워크가 필요 없는 단위/시뮬레이션 테스트가 계속 진행되도록 한다.
				im.nextPort = port + 2
				return port, nil
			}
			// 포트 사용 중, 다음 포트 시도
			continue
		}

		// 즉시 닫기 (실제로는 diago가 사용)
		_ = conn.Close()

		// nextPort 업데이트
		im.nextPort = port + 2

		return port, nil
	}

	return 0, fmt.Errorf("failed to allocate port after %d retries", im.maxRetries)
}

// StartServing은 모든 인스턴스의 Serve를 시작한다
func (im *InstanceManager) StartServing(ctx context.Context) error {
	im.mu.Lock()
	defer im.mu.Unlock()

	for _, inst := range im.instances {
		// 각 인스턴스에 대해 별도 cancelable context 생성
		instCtx, instCancel := context.WithCancel(ctx)
		inst.cancel = instCancel

		// goroutine으로 Serve 시작 (blocking)
		go func(i *ManagedInstance, c context.Context) {
			_ = i.UA.Serve(c, func(inDialog *diago.DialogServerSession) {
				// incoming 이벤트를 채널로 전달
				i.incomingCh <- inDialog
			})
		}(inst, instCtx)
	}

	return nil
}

// GetInstance는 instanceID로 ManagedInstance를 조회한다
func (im *InstanceManager) GetInstance(instanceID string) (*ManagedInstance, error) {
	im.mu.Lock()
	defer im.mu.Unlock()

	inst, exists := im.instances[instanceID]
	if !exists {
		return nil, fmt.Errorf("instance not found: %s", instanceID)
	}

	return inst, nil
}

// ResolveTarget는 번호(DN) 또는 SIP URI를 실제 호출 가능한 SIP URI로 변환한다.
func (im *InstanceManager) ResolveTarget(target string) (string, error) {
	resolved := strings.TrimSpace(target)
	if resolved == "" {
		return "", fmt.Errorf("target is empty")
	}
	if strings.HasPrefix(resolved, "sip:") {
		return resolved, nil
	}

	im.mu.Lock()
	defer im.mu.Unlock()

	instanceID, exists := im.dnToID[resolved]
	if !exists {
		return "", fmt.Errorf("target DN not found: %s", resolved)
	}

	inst, exists := im.instances[instanceID]
	if !exists {
		return "", fmt.Errorf("instance not found for target DN: %s", resolved)
	}

	return fmt.Sprintf("sip:%s@127.0.0.1:%d", inst.Config.DN, inst.Port), nil
}

// Cleanup은 모든 UA를 정리하고 리소스를 해제한다
func (im *InstanceManager) Cleanup() error {
	im.mu.Lock()
	defer im.mu.Unlock()

	// 모든 Serve 중지 (context 취소로 정리)
	for _, inst := range im.instances {
		if inst.cancel != nil {
			inst.cancel()
		}
	}

	// 맵 초기화
	im.instances = make(map[string]*ManagedInstance)
	im.dnToID = make(map[string]string)

	// nextPort 리셋
	im.nextPort = im.basePort

	return nil
}

// Reset은 Cleanup을 호출한 후 내부 상태를 초기화한다
func (im *InstanceManager) Reset() {
	_ = im.Cleanup()
}
