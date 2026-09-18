import {
  type ProjectsState,
  useProjectsContext,
} from '../context/ProjectsProvider';

export type { ProjectsState };

export function useProjects(): ProjectsState {
  return useProjectsContext();
}
