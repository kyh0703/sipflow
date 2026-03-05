package entity

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
