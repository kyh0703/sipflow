const EVENT_LABEL_OVERRIDES: Record<string, string> = {
  INCOMING: 'Incoming',
  DISCONNECTED: 'Disconnect',
  RINGING: 'Ringing',
  TIMEOUT: 'Timeout',
  HELD: 'Held',
  RETRIEVED: 'Retrieved',
  TRANSFERRED: 'Transferred',
  DTMFReceived: 'DtmfReceived',
};

export function formatEventLabel(eventName: string): string {
  return EVENT_LABEL_OVERRIDES[eventName] ?? eventName;
}
