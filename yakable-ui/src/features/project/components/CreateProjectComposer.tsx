import { PromptComposer } from '@/shared/ui';

export function CreateProjectComposer() {
  return (
    <PromptComposer
      ariaLabel="Describe the project you want to build"
      placeholder="Ask Yakable to build..."
      submitLabel="Create project"
    />
  );
}
