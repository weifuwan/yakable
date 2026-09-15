import { randomUUID } from 'node:crypto';
import path from 'node:path';

import {
  createDefaultAgentRuntime,
  type AgentRuntime,
} from '../agent-runtime/agent-runtime.js';
import { classifyBuildIntent } from '../prompt-intelligence/build-intent.js';
import { classifyProjectMessageIntent } from '../prompt-intelligence/project-message.js';
import {
  deleteManagedProject,
  listManagedProjects,
  remixManagedProject,
  touchManagedProject,
  updateManagedProject,
} from '../projects/project-actions.js';
import {
  createGeneratedProjectIdentity,
} from '../projects/project.js';
import { readProjectMetadata } from '../projects/project-metadata.js';
import {
  appendProjectEditHistory,
  readProjectConversation,
  readProjectSession,
  writeProjectSession,
} from '../projects/project-session.js';
import { resolveGeneratedProject, startGeneratedProject } from '../runtime/runtime.js';
import { readAgentRun } from '../storage/agent-run.js';
import {
  beginProjectBuildLifecycle,
  failProjectLifecycle,
  listActiveProjectLifecycles,
  readProjectLifecycle,
  transitionProjectLifecycle,
} from '../storage/project-lifecycle.js';
import { createBaseProject } from '../templates/base-template.js';
import type { BuildIntentDecision } from '../types.js';
import {
  WorkspaceChangeManager,
  workspaceMutationsFromFiles,
} from '../workspace/index.js';
import type {
  WebApiServices,
  WebCreateProjectBootstrap,
  WebCreateProjectStatus,
  WebGeneratedProject,
} from './web-api-contract.js';

const CONVERSATION_PROJECT_NAME_MAX = 56;
const INTERRUPTED_CREATE_MESSAGE =
  'This build was interrupted because Yakable restarted before generation finished. Retry the build to continue.';
const EMPTY_CONVERSATION_APP = `export default function App() {
  return <main className="min-h-screen bg-white" aria-label="Empty project preview" />;
}\n`;

export function projectNameFromId(projectId: string): string {
  const base = projectId.replace(/-\d{4}-\d{2}-\d{2}T.*$/, '');
  return (base || projectId)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function conversationProjectName(prompt: string): string {
  const normalized = prompt.replace(/\s+/g, ' ').trim();
  if (normalized.length <= CONVERSATION_PROJECT_NAME_MAX) return normalized;
  return `${normalized.slice(0, CONVERSATION_PROJECT_NAME_MAX - 1)}…`;
}

function conversationProjectId(prompt: string, createdAt: string): string {
  const slug = prompt
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32) || 'conversation';
  const timestamp = createdAt.replace(/[:.]/g, '-');
  return `${slug}-${timestamp}-${randomUUID().slice(0, 8)}`;
}

async function createConversationProject(
  prompt: string,
  decision: BuildIntentDecision,
  generatedRoot: string,
): Promise<WebGeneratedProject> {
  const createdAt = new Date().toISOString();
  const name = conversationProjectName(prompt);
  const created = await createBaseProject(conversationProjectId(prompt, createdAt), {
    outputRoot: generatedRoot,
    displayName: name,
  });

  const changes = new WorkspaceChangeManager(created.directory);
  await changes.apply(
    'Initialize empty conversation preview',
    workspaceMutationsFromFiles([{ path: 'src/App.tsx', content: EMPTY_CONVERSATION_APP }]),
  );

  await writeProjectSession(created.directory, {
    version: 1,
    productRequest: prompt,
    initialSummary: decision.message,
    createdAt,
    updatedAt: createdAt,
    edits: [],
  });

  const metadata = await readProjectMetadata(created.directory);
  return {
    id: created.id,
    name: metadata.name ?? name,
    summary: decision.message,
    model: 'build-intent',
    template: metadata.template,
    routes: metadata.routes,
    session: await readProjectSession(created.directory),
    conversation: await readProjectConversation(created.directory),
  };
}

function bootstrapCreateProject(
  prompt: string,
  decision: BuildIntentDecision,
): WebCreateProjectBootstrap {
  if (decision.route !== 'CREATE') {
    throw new Error(`Async project bootstrap requires CREATE intent, received ${decision.route}.`);
  }

  const identity = createGeneratedProjectIdentity(prompt);
  const lifecycle = beginProjectBuildLifecycle({
    projectId: identity.projectId,
    prompt,
    createdAt: identity.createdAt,
  });

  return {
    reservation: {
      projectId: lifecycle.project.projectId,
      agentRunId: lifecycle.run.id,
      createdAt: lifecycle.project.createdAt,
    },
    project: {
      id: lifecycle.project.projectId,
      name: projectNameFromId(lifecycle.project.projectId),
      prompt: lifecycle.project.prompt,
      status: lifecycle.project.status,
      createdAt: lifecycle.project.createdAt,
      updatedAt: lifecycle.project.updatedAt,
    },
    run: {
      id: lifecycle.run.id,
      status: lifecycle.run.status,
      startedAt: lifecycle.run.startedAt,
    },
  };
}

function readCreateProjectStatus(projectId: string): WebCreateProjectStatus | null {
  const lifecycle = readProjectLifecycle(projectId);
  if (!lifecycle) return null;

  const run = lifecycle.activeRunId ? readAgentRun(lifecycle.activeRunId) : null;
  return {
    project: {
      id: lifecycle.projectId,
      name: projectNameFromId(lifecycle.projectId),
      prompt: lifecycle.prompt,
      status: lifecycle.status,
      ...(lifecycle.activeRunId ? { activeRunId: lifecycle.activeRunId } : {}),
      ...(lifecycle.failureMessage ? { failureMessage: lifecycle.failureMessage } : {}),
      createdAt: lifecycle.createdAt,
      updatedAt: lifecycle.updatedAt,
    },
    run: run
      ? {
          id: run.id,
          status: run.status,
          ...(run.model ? { model: run.model } : {}),
          ...(run.summary ? { summary: run.summary } : {}),
          startedAt: run.startedAt,
          ...(run.completedAt ? { completedAt: run.completedAt } : {}),
          items: run.items,
        }
      : null,
  };
}

export function createDefaultWebApiServices(
  generatedRoot = path.resolve(process.cwd(), 'generated'),
  agentRuntime: AgentRuntime = createDefaultAgentRuntime(),
): WebApiServices {
  return {
    async listProjects() {
      return listManagedProjects(generatedRoot);
    },

    async gateBuildIntent(prompt) {
      return classifyBuildIntent(prompt);
    },

    async bootstrapCreate(prompt, buildIntent) {
      return bootstrapCreateProject(prompt, buildIntent);
    },

    async readCreateStatus(projectId) {
      return readCreateProjectStatus(projectId);
    },

    async reconcileInterruptedCreates() {
      const failedProjectIds: string[] = [];
      const runtimePendingProjectIds: string[] = [];

      for (const lifecycle of listActiveProjectLifecycles()) {
        if (lifecycle.status === 'STARTING_RUNTIME') {
          runtimePendingProjectIds.push(lifecycle.projectId);
          continue;
        }
        failProjectLifecycle(lifecycle.projectId, INTERRUPTED_CREATE_MESSAGE);
        failedProjectIds.push(lifecycle.projectId);
      }

      return { failedProjectIds, runtimePendingProjectIds };
    },

    async generate(prompt, buildIntent, onAgentItem, reservation) {
      if (buildIntent.route !== 'CREATE') {
        if (reservation) {
          throw new Error('A reserved project lifecycle can only execute CREATE intent.');
        }
        return createConversationProject(prompt, buildIntent, generatedRoot);
      }
      const result = await agentRuntime.createProject(prompt, {
        buildIntent,
        onEvent: onAgentItem,
        verifyProject: true,
        persistAgentRun: true,
        ...(reservation ? { projectLifecycle: reservation } : {}),
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

    async message(projectId, prompt) {
      const project = await resolveGeneratedProject(projectId, generatedRoot);
      const session = await readProjectSession(project.directory);
      const conversation = await readProjectConversation(project.directory);
      const hasGeneratedUi = Boolean(
        session?.designIntent || session?.edits.some((edit) => edit.changedFiles.length > 0),
      );
      const decision = await classifyProjectMessageIntent({
        userInput: prompt,
        hasGeneratedUi,
        recentConversation:
          conversation?.messages.slice(-10).map((message) => ({
            role: message.role,
            content: message.content,
          })) ?? [],
      });

      if (decision.route === 'CHAT' || decision.route === 'CLARIFY') {
        await appendProjectEditHistory(project.directory, {
          userRequest: prompt,
          assistantSummary: decision.message,
          changedFiles: [],
          model: 'project-message-router',
        });
        await touchManagedProject(projectId, generatedRoot);
      }
      return {
        decision,
        conversation: await readProjectConversation(project.directory),
      };
    },

    async beginEditRun(projectId, prompt, onRunCreated, onAgentItem) {
      const result = await agentRuntime.beginEditRun(projectId, prompt, {
        onRunCreated,
        onItem: onAgentItem,
      });
      if (result.changedFiles.length > 0) {
        await touchManagedProject(projectId, generatedRoot);
      }
      return result;
    },

    async continueEditRun(runId, result, onAgentItem) {
      const next = await agentRuntime.continueEditRun(runId, result, { onItem: onAgentItem });
      if (next.changedFiles.length > 0) {
        await touchManagedProject(next.projectId, generatedRoot);
      }
      return next;
    },

    async startRuntime(projectId) {
      const lifecycle = readProjectLifecycle(projectId);
      const trackCreationLifecycle = Boolean(
        lifecycle
        && (lifecycle.status === 'GENERATING' || lifecycle.status === 'STARTING_RUNTIME'),
      );

      if (lifecycle?.status === 'GENERATING') {
        transitionProjectLifecycle(projectId, 'STARTING_RUNTIME');
      }

      try {
        const project = await resolveGeneratedProject(projectId, generatedRoot);
        const metadata = await readProjectMetadata(project.directory);
        const started = await startGeneratedProject(project, { port: 0 });
        if (trackCreationLifecycle) {
          transitionProjectLifecycle(projectId, 'READY');
        }
        return {
          url: started.url,
          metadata,
          isAlive: () => Boolean(started.server.httpServer?.listening),
          close: async () => {
            await started.server.close();
          },
        };
      } catch (error) {
        if (trackCreationLifecycle) {
          try {
            failProjectLifecycle(projectId, error);
          } catch (lifecycleError) {
            console.warn('[Yakable Runtime] Project lifecycle could not be marked failed.', lifecycleError);
          }
        }
        throw error;
      }
    },

    async readSession(projectId) {
      const project = await resolveGeneratedProject(projectId, generatedRoot);
      return readProjectSession(project.directory);
    },

    async readConversation(projectId) {
      const project = await resolveGeneratedProject(projectId, generatedRoot);
      return readProjectConversation(project.directory);
    },

    async updateProject(projectId, patch) {
      return updateManagedProject(projectId, patch, generatedRoot);
    },

    async remixProject(projectId) {
      return remixManagedProject(projectId, generatedRoot);
    },

    async deleteProject(projectId) {
      await deleteManagedProject(projectId, generatedRoot);
    },
  };
}
