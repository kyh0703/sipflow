import {
  StartScenario,
  StopScenario,
  IsRunning,
} from '../../../../wailsjs/go/binding/EngineBinding';

/**
 * Hook providing typed wrappers around Wails EngineBinding calls
 */
export function useEngineApi() {
  const startScenario = async (scenarioId: string): Promise<void> => {
    try {
      await StartScenario(scenarioId);
    } catch (error) {
      console.error('Failed to start scenario:', error);
      throw error;
    }
  };

  const stopScenario = async (): Promise<void> => {
    try {
      await StopScenario();
    } catch (error) {
      console.error('Failed to stop scenario:', error);
      throw error;
    }
  };

  const isRunning = async (): Promise<boolean> => {
    try {
      return await IsRunning();
    } catch (error) {
      console.error('Failed to check running status:', error);
      return false;
    }
  };

  return {
    startScenario,
    stopScenario,
    isRunning,
  };
}
