import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export type SIPTransport = 'UDP' | 'TCP' | 'TLS';

interface AppSettingsState {
  pbxHost: string;
  pbxPort: string;
  pbxDomain: string;
  transport: SIPTransport;
  outboundProxy: string;
  setField: <K extends keyof Omit<AppSettingsState, 'setField'>>(key: K, value: AppSettingsState[K]) => void;
}

export const useAppSettingsStore = create<AppSettingsState>()(
  persist(
    (set) => ({
      pbxHost: '',
      pbxPort: '5060',
      pbxDomain: '',
      transport: 'UDP',
      outboundProxy: '',
      setField: (key, value) => set({ [key]: value } as Pick<AppSettingsState, typeof key>),
    }),
    {
      name: 'sipflow-app-settings',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
