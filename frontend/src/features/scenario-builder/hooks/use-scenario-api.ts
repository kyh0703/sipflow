import {
  CreateScenario,
  SaveScenario,
  LoadScenario,
  ListScenarios,
  DeleteScenario,
  RenameScenario,
} from '../../../../wailsjs/go/binding/ScenarioBinding';
import { scenario } from '../../../../wailsjs/go/models';

export type ScenarioListItem = scenario.ScenarioListItem;
export type Scenario = scenario.Scenario;

/**
 * Hook providing typed wrappers around Wails ScenarioBinding calls
 */
export function useScenarioApi() {
  const createScenario = async (name: string): Promise<Scenario> => {
    try {
      const scenario = await CreateScenario(name);
      return scenario;
    } catch (error) {
      console.error('Failed to create scenario:', error);
      throw error;
    }
  };

  const saveScenario = async (id: string, flowData: string): Promise<void> => {
    try {
      await SaveScenario(id, flowData);
    } catch (error) {
      console.error('Failed to save scenario:', error);
      throw error;
    }
  };

  const loadScenario = async (id: string): Promise<Scenario> => {
    try {
      const scenario = await LoadScenario(id);
      return scenario;
    } catch (error) {
      console.error('Failed to load scenario:', error);
      throw error;
    }
  };

  const listScenarios = async (): Promise<ScenarioListItem[]> => {
    try {
      const scenarios = await ListScenarios();
      return scenarios;
    } catch (error) {
      console.error('Failed to list scenarios:', error);
      throw error;
    }
  };

  const deleteScenario = async (id: string): Promise<void> => {
    try {
      await DeleteScenario(id);
    } catch (error) {
      console.error('Failed to delete scenario:', error);
      throw error;
    }
  };

  const renameScenario = async (id: string, newName: string): Promise<void> => {
    try {
      await RenameScenario(id, newName);
    } catch (error) {
      console.error('Failed to rename scenario:', error);
      throw error;
    }
  };

  return {
    createScenario,
    saveScenario,
    loadScenario,
    listScenarios,
    deleteScenario,
    renameScenario,
  };
}
