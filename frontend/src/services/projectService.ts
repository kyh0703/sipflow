import * as ProjectServiceBindings from '../../wailsjs/go/handler/ProjectService'
import type { handler } from '../../wailsjs/go/models'

/**
 * Project service wrapper providing typed access to backend ProjectService
 */
export const projectService = {
  /**
   * Create a new .sipflow project file via save dialog
   */
  async newProject(): Promise<handler.Response_bool_> {
    return ProjectServiceBindings.NewProject()
  },

  /**
   * Open an existing .sipflow project file via open dialog
   */
  async openProject(): Promise<handler.Response_string_> {
    return ProjectServiceBindings.OpenProject()
  },

  /**
   * Close the current project
   */
  async closeProject(): Promise<handler.Response_bool_> {
    return ProjectServiceBindings.CloseProject()
  },

  /**
   * Save current project to a new location via save dialog
   */
  async saveProjectAs(): Promise<handler.Response_string_> {
    return ProjectServiceBindings.SaveProjectAs()
  },

  /**
   * Get the current project file path
   */
  async currentProjectPath(): Promise<string> {
    return ProjectServiceBindings.CurrentProjectPath()
  },

  /**
   * Check if a project is currently open
   */
  async isProjectOpen(): Promise<boolean> {
    return ProjectServiceBindings.IsProjectOpen()
  },
}
