import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  DEFAULT_MODEL_SELECTION,
  ModelSelector,
  type ModelSelection,
} from '@/features/model';
import { PromptComposer } from '@/shared/ui';

import { createProject } from '../api/project-api';
import { useProjects } from '../hooks/useProjects';

export function CreateProjectComposer() {
  const navigate = useNavigate();
  const { upsertProject } = useProjects();
  const [selectedModel, setSelectedModel] = useState<ModelSelection>(
    DEFAULT_MODEL_SELECTION,
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (prompt: string) => {
    setError(null);

    try {
      const project = await createProject({
        prompt,
        model: selectedModel,
      });

      upsertProject(project);
      navigate('/dashboard/project/' + encodeURIComponent(project.id));
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
      <PromptComposer
        ariaLabel="Describe the project you want to build"
        placeholder="Ask Yakable to build..."
        submitLabel="Create project"
        trailingActions={
          <ModelSelector
            value={selectedModel}
            onValueChange={setSelectedModel}
          />
        }
        onSubmit={handleSubmit}
      />

      {error && (
        <p className="mb-0 mt-2 px-2 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
