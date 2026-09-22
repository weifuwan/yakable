import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  DEFAULT_MODEL_SELECTION,
  ModelSelector,
  type ModelSelection,
} from '@/features/model';
import { ProjectService } from '@/service/project';
import { PromptComposer, PromptComposerSkeleton } from '@/shared/ui';

import { useProjects } from '../hooks/useProjects';

const PLACEHOLDER_SUGGESTIONS = [
  'build a landing page...',
  'create a dashboard...',
  'design a SaaS website...',
  'build an admin panel...',
] as const;

function projectSessionPath(projectId: string, sessionId: string) {
  return (
    '/dashboard/project/' +
    encodeURIComponent(projectId) +
    '/session/' +
    encodeURIComponent(sessionId)
  );
}

export function CreateProjectComposer() {
  const navigate = useNavigate();
  const { isLoading, upsertProject } = useProjects();
  const [selectedModel, setSelectedModel] = useState<ModelSelection>(
    DEFAULT_MODEL_SELECTION,
  );
  const [error, setError] = useState<string | null>(null);
  const pendingRequestRef = useRef<{
    fingerprint: string;
    requestId: string;
  } | null>(null);

  const handleSubmit = async (prompt: string) => {
    setError(null);
    const fingerprint = [
      selectedModel.provider,
      selectedModel.model,
      prompt,
    ].join('\n');
    const currentRequest = pendingRequestRef.current;
    const pendingRequest = currentRequest?.fingerprint === fingerprint
      ? currentRequest
      : {
          fingerprint,
          requestId: globalThis.crypto.randomUUID(),
        };
    pendingRequestRef.current = pendingRequest;
    const requestId = pendingRequest.requestId;

    try {
      const project = await ProjectService.addProject({
        prompt,
        model: selectedModel,
        requestId,
      });

      pendingRequestRef.current = null;
      upsertProject(project);
      navigate(projectSessionPath(project.id, project.latestSessionId));
      return true;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to create project.',
      );
      return false;
    }
  };

  return (
    <div>
      {isLoading ? (
        <PromptComposerSkeleton />
      ) : (
        <PromptComposer
          ariaLabel="Describe the project you want to build"
          placeholder="Ask Yakable to build..."
          placeholderPrefix="Ask Yakable to"
          placeholderSuggestions={PLACEHOLDER_SUGGESTIONS}
          submitLabel="Create project"
          trailingActions={
            <ModelSelector
              surface="borderless"
              value={selectedModel}
              onValueChange={setSelectedModel}
            />
          }
          onSubmit={handleSubmit}
        />
      )}

      {error && (
        <p className="mb-0 mt-2 px-2 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
