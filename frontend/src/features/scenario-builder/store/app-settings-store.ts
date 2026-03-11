import { createPersistStore } from '@/lib/store';

export type SIPTransport = 'UDP' | 'TCP' | 'TLS';

export interface PbxInstanceSettings {
  id: string;
  name: string;
  host: string;
  port: string;
  domain: string;
  transport: SIPTransport;
  outboundProxy: string;
}

interface AppSettingsStoreState {
  pbxInstances: PbxInstanceSettings[];
  actions: {
    addPbxInstance: () => PbxInstanceSettings;
    updatePbxInstance: (id: string, patch: Partial<Omit<PbxInstanceSettings, 'id'>>) => void;
    removePbxInstance: (id: string) => void;
  };
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `pbx-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyPbxInstance(index: number): PbxInstanceSettings {
  return {
    id: createId(),
    name: `PBX ${index + 1}`,
    host: '',
    port: '5060',
    domain: '',
    transport: 'UDP',
    outboundProxy: '',
  };
}

export const useAppSettingsStore = createPersistStore<AppSettingsStoreState>(
  (set, get) => ({
    pbxInstances: [],
    actions: {
      addPbxInstance: () => {
        const instance = createEmptyPbxInstance(get().pbxInstances.length);

        set((state) => {
          state.pbxInstances.push(instance);
        });

        return instance;
      },
      updatePbxInstance: (id, patch) => {
        set((state) => {
          const target = state.pbxInstances.find((instance) => instance.id === id);

          if (!target) {
            return;
          }

          Object.assign(target, patch);
        });
      },
      removePbxInstance: (id) => {
        set((state) => {
          state.pbxInstances = state.pbxInstances.filter((instance) => instance.id !== id);
        });
      },
    },
  }),
  {
    name: 'sipflow-app-settings',
    version: 1,
    migrate: (persistedState, version) => {
      const state = (persistedState ?? {}) as {
        pbxInstances?: PbxInstanceSettings[];
        pbxHost?: string;
        pbxPort?: string;
        pbxDomain?: string;
        transport?: SIPTransport;
        outboundProxy?: string;
      };

      if (version === 0 && !Array.isArray(state.pbxInstances)) {
        const hasLegacyValues = Boolean(
          state.pbxHost || state.pbxDomain || state.outboundProxy || state.transport || state.pbxPort
        );

        return {
          pbxInstances: hasLegacyValues
            ? [
                {
                  id: createId(),
                  name: 'PBX 1',
                  host: state.pbxHost ?? '',
                  port: state.pbxPort ?? '5060',
                  domain: state.pbxDomain ?? '',
                  transport: state.transport ?? 'UDP',
                  outboundProxy: state.outboundProxy ?? '',
                },
              ]
            : [],
        } satisfies Partial<AppSettingsStoreState>;
      }

      return {
        pbxInstances: Array.isArray(state.pbxInstances) ? state.pbxInstances : [],
      } satisfies Partial<AppSettingsStoreState>;
    },
    partialize: (state) => ({
      pbxInstances: state.pbxInstances,
    }),
  }
);

export const usePbxInstances = () =>
  useAppSettingsStore((state) => state.pbxInstances);

export const useAppSettingsActions = () =>
  useAppSettingsStore((state) => state.actions);
