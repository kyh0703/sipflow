import { GetSupportedCommands, GetSupportedEvents } from '../../../../wailsjs/go/binding/EngineBinding';
import { COMMAND_TYPES, EVENT_TYPES } from '../types/scenario';

function diffContracts(localValues: readonly string[], backendValues: string[], label: string): string[] {
  const missingInBackend = localValues.filter((value) => !backendValues.includes(value));
  const extraInBackend = backendValues.filter((value) => !localValues.includes(value));
  const issues: string[] = [];

  if (missingInBackend.length > 0) {
    issues.push(`[Backend Contract] Missing ${label} in backend: ${missingInBackend.join(', ')}`);
  }

  if (extraInBackend.length > 0) {
    issues.push(`[Backend Contract] Extra ${label} in backend: ${extraInBackend.join(', ')}`);
  }

  return issues;
}

export async function validateBackendContract(): Promise<string[]> {
  const [backendCommands, backendEvents] = await Promise.all([
    GetSupportedCommands(),
    GetSupportedEvents(),
  ]);

  return [
    ...diffContracts(COMMAND_TYPES, backendCommands, 'commands'),
    ...diffContracts(EVENT_TYPES, backendEvents, 'events'),
  ];
}
