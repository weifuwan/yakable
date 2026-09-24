import type { ProjectFile } from '@/service/project';
import { Markdown } from '@/shared/ui';

interface ProjectFileViewerProps {
  selectedPath: string | null;
  file: ProjectFile | null;
  loading: boolean;
  error: string | null;
}

const languageByExtension: Record<string, string> = {
  ts: 'typescript',
  tsx: 'tsx',
  js: 'javascript',
  jsx: 'jsx',
  json: 'json',
  css: 'css',
  html: 'html',
  htm: 'html',
  md: 'markdown',
  java: 'java',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  sql: 'sql',
  sh: 'bash',
  bash: 'bash',
  py: 'python',
  properties: 'properties',
};

function languageForPath(path: string) {
  const fileName = path.split(/[\\/]/).at(-1) ?? path;
  const extension = fileName.includes('.') ? fileName.split('.').at(-1)?.toLowerCase() : undefined;
  return extension ? (languageByExtension[extension] ?? 'text') : 'text';
}

function fencedCode(path: string, content: string) {
  const longestFence = Math.max(2, ...[...content.matchAll(/`+/g)].map((match) => match[0].length));
  const fence = '`'.repeat(longestFence + 1);
  const suffix = content.endsWith('\n') ? '' : '\n';
  return fence + languageForPath(path) + '\n' + content + suffix + fence;
}

export function ProjectFileViewer({ selectedPath, file, loading, error }: ProjectFileViewerProps) {
  if (!selectedPath) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-sm text-foreground-subtle">
        Select a file to view its contents.
      </div>
    );
  }

  if (loading) {
    return (
      <output className="flex h-full items-center justify-center text-sm text-foreground-subtle">
        Loading file...
      </output>
    );
  }

  if (error) {
    return (
      <div
        className="m-4 rounded-xl border border-danger-border-subtle bg-danger-surface px-4 py-3 text-sm text-danger-foreground"
        role="alert"
      >
        {error}
      </div>
    );
  }

  if (!file) {
    return null;
  }

  return (
    <div className="h-full overflow-auto p-3 scrollbar-subtle">
      <Markdown
        content={fencedCode(file.path, file.content)}
        className="[&_[data-streamdown='code-block']]:m-0 [&_[data-streamdown='code-block']]:rounded-xl [&_[data-streamdown='code-block']]:border [&_[data-streamdown='code-block']]:border-border-quiet"
      />
    </div>
  );
}
