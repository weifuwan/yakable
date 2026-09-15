import path from 'node:path';

import { resolveGeneratedProject } from '../runtime/runtime.js';
import {
  readWorkspaceDiff,
  type WorkspaceDiffSnapshot,
} from '../workspace/workspace-diff.js';

export async function readProjectWorkspaceDiff(
  projectInput: string,
  generatedRoot = path.resolve(process.cwd(), 'generated'),
): Promise<WorkspaceDiffSnapshot> {
  const project = await resolveGeneratedProject(projectInput, generatedRoot);
  return readWorkspaceDiff(project.directory);
}
