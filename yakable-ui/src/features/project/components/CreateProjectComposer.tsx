import { useState } from 'react';

import {
  DEFAULT_MODEL_SELECTION,
  ModelSelector,
  type ModelSelection,
} from '@/features/model';
import { PromptComposer } from '@/shared/ui';

export function CreateProjectComposer() {
  const [selectedModel, setSelectedModel] = useState<ModelSelection>(
    DEFAULT_MODEL_SELECTION,
  );

  return (
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
      onSubmit={() => false}
    />
  );
}
