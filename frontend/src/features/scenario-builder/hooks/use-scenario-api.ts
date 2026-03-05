import {
  CreateScenario,
  SaveScenario,
  LoadScenario,
  LoadNodeProperty,
  ListScenarios,
  DeleteScenario,
  RenameScenario,
  UpsertNodeProperty,
} from '../../../../wailsjs/go/binding/ScenarioBinding';
import { entity } from '../../../../wailsjs/go/models';
import { dto } from '../../../../wailsjs/go/models';

export type ScenarioListItem = entity.ScenarioListItem;
export type Scenario = entity.Scenario;
export type NodePropertyRecord = entity.NodePropertyRecord;
export type NodePropertyUpsert = dto.NodePropertyUpsert;

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

  const upsertNodeProperty = async (
    scenarioId: string,
    nodeId: string,
    propertiesJSON: string
  ): Promise<void> => {
    try {
      await UpsertNodeProperty({
        scenario_id: scenarioId,
        node_id: nodeId,
        schema_version: 1,
        properties_json: propertiesJSON,
      });
    } catch (error) {
      console.error('Failed to upsert node property:', error);
      throw error;
    }
  };

  const loadNodeProperty = async (
    scenarioId: string,
    nodeId: string
  ): Promise<NodePropertyRecord> => {
    try {
      const property = await LoadNodeProperty(scenarioId, nodeId);
      return property;
    } catch (error) {
      console.error('Failed to load node property:', error);
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
    upsertNodeProperty,
    loadNodeProperty,
  };
}
