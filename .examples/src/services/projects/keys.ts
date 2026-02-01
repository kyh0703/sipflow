export const projectKey = {
  all: ['projects'] as const,
  flows: (projectId: string) => [...projectKey.all, projectId] as const,
}
