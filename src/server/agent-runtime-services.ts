import path from 'node:path';

import {
  createDefaultAgentRuntime,
  type AgentRuntime,
} from '../agent-runtime/agent-runtime.js';
import { touchManagedProject } from '../projects/project-actions.js';
import {
  readProjectConversation,
  readProjectSession,
} from '../projects/project-session.js';
import {
  createDefaultWebApiServices,
  type WebApiServices,
} from './web-api.js';

function projectNameFromId(projectId: string): string {
  const base = projectId.replace(/-\d{4}-\d{2}-\d{2}T.*$/, '');
  return (base || projectId)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Compatibility adapter that moves create/edit entry points behind AgentRuntime
 * while leaving the existing HTTP contract and workflow behavior unchanged.
 */
export function createAgentRuntimeWebApiServices(
  generatedRoot = path.resolve(process.cwd(), 'generated'),
  runtime: AgentRuntime = createDefaultAgentRuntime(),
): WebApiServices {
  const legacy = createDefaultWebApiServices(generatedRoot);

  return {
    ...legacy,

    async generate(prompt, buildIntent, onAgentEvent) {
      if (buildIntent.route !== 'CREATE') {
        return legacy.generate(prompt, buildIntent, onAgentEvent);
      }

      const result = await runtime.createProject(prompt, {
        buildIntent,
        onEvent: onAgentEvent,
        verifyProject: true,
        persistAgentRun: true,
      });
      const id = path.basename(result.outputDirectory);
      return {
        id,
        name: projectNameFromId(id),
        summary: result.project.summary,
        model: result.model,
        template: result.project.template,
        routes: result.project.routes,
        ...(result.agentRunId ? { agentRunId: result.agentRunId } : {}),
        session: await readProjectSession(result.outputDirectory),
        conversation: await readProjectConversation(result.outputDirectory),
      };
    },

    async edit(projectId, prompt, onAgentEvent) {
      const result = await runtime.editProject(projectId, prompt, {
        onEvent: onAgentEvent,
      });
      await touchManagedProject(projectId, generatedRoot);
      return {
        projectId: result.projectId,
        summary: result.summary,
        model: result.model,
        changedFiles: result.changedFiles,
        editIntent: result.editIntent,
        contextSelection: result.contextSelection,
        projectCheck: result.projectCheck,
        agentTrace: result.agentTrace,
        session: result.session,
        conversation: await readProjectConversation(result.projectDirectory),
      };
    },
  };
}
