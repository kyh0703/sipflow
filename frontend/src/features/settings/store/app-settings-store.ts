import { createPersistStore } from '@/lib/store';

export type SIPTransport = 'UDP' | 'TCP';

export interface PbxInstanceSettings {
  id: string;
  name: string;
  host: string;
  port: string;
  transport: SIPTransport;
  registerInterval: string;
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
    name: `SIP ${index + 1}`,
    host: '',
    port: '5060',
    transport: 'UDP',
    registerInterval: '300',
  };
}

function normalizePbxInstance(
  instance: Partial<PbxInstanceSettings> | undefined,
  index: number
): PbxInstanceSettings {
  return {
    id: instance?.id || createId(),
    name: instance?.name || `SIP ${index + 1}`,
    host: instance?.host || '',
    port: instance?.port || '5060',
    transport: instance?.transport === 'TCP' ? 'TCP' : 'UDP',
    registerInterval: instance?.registerInterval || '300',
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
          const target = state.pbxInstances.find(
            (instance: PbxInstanceSettings) => instance.id === id
          );

          if (!target) {
            return;
          }

          Object.assign(target, patch);
        });
      },
      removePbxInstance: (id) => {
        set((state) => {
          state.pbxInstances = state.pbxInstances.filter(
            (instance: PbxInstanceSettings) => instance.id !== id
          );
        });
      },
    },
  }),
  {
    name: 'sipflow-app-settings',
    version: 2,
    migrate: (persistedState, version) => {
      const state = (persistedState ?? {}) as {
        pbxInstances?: PbxInstanceSettings[];
        pbxHost?: string;
        pbxPort?: string;
        transport?: SIPTransport;
        registerInterval?: string;
        name?: string;
      };

      if (version === 0 && !Array.isArray(state.pbxInstances)) {
        const hasLegacyValues = Boolean(
          state.pbxHost || state.transport || state.pbxPort || state.name
        );

        return {
          pbxInstances: hasLegacyValues
            ? [
              normalizePbxInstance(
                {
                  name: state.name ?? 'SIP 1',
                  host: state.pbxHost ?? '',
                  port: state.pbxPort ?? '5060',
                  transport: state.transport ?? 'UDP',
                  registerInterval: state.registerInterval ?? '300',
                },
                0
              ),
            ]
            : [],
        } satisfies Partial<AppSettingsStoreState>;
      }

      return {
        pbxInstances: Array.isArray(state.pbxInstances)
          ? state.pbxInstances.map((instance, index) => normalizePbxInstance(instance, index))
          : [],
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
