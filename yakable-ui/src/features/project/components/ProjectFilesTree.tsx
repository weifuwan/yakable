import { cx, Icon } from '@/shared/ui';

interface ProjectFilesTreeProps {
  files: string[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

interface DirectoryNode {
  directories: Map<string, DirectoryNode>;
  files: Map<string, string>;
}

function createDirectory(): DirectoryNode {
  return {
    directories: new Map(),
    files: new Map(),
  };
}

function buildTree(files: string[]) {
  const root = createDirectory();

  for (const path of files) {
    const parts = path.split(/[\\/]/).filter(Boolean);
    if (parts.length === 0) continue;

    let current = root;
    for (const directory of parts.slice(0, -1)) {
      const existing = current.directories.get(directory);
      if (existing) {
        current = existing;
        continue;
      }

      const next = createDirectory();
      current.directories.set(directory, next);
      current = next;
    }

    current.files.set(parts.at(-1) ?? path, path);
  }

  return root;
}

function FileIcon() {
  return (
    <Icon size={14} className="shrink-0 text-foreground-muted">
      <path d="M6 2h8l4 4v16H6z" />
      <path d="M14 2v5h5" />
    </Icon>
  );
}

function FolderIcon() {
  return (
    <Icon size={14} className="shrink-0 text-foreground-muted">
      <path d="M3 6h7l2 2h9v10H3z" />
    </Icon>
  );
}

function DirectoryEntries({
  node,
  selectedPath,
  onSelect,
}: {
  node: DirectoryNode;
  selectedPath: string | null;
  onSelect: (path: string) => void;
}) {
  const directories = [...node.directories.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const files = [...node.files.entries()].sort(([left], [right]) => left.localeCompare(right));

  return (
    <ul className="space-y-0.5">
      {directories.map(([name, child]) => (
        <li key={'directory:' + name}>
          <div className="flex h-7 items-center gap-1.5 px-2 text-xs font-medium text-foreground-secondary">
            <FolderIcon />
            <span className="truncate">{name}</span>
          </div>
          <div className="ml-3 border-l border-border-quiet pl-1.5">
            <DirectoryEntries node={child} selectedPath={selectedPath} onSelect={onSelect} />
          </div>
        </li>
      ))}

      {files.map(([name, path]) => (
        <li key={path}>
          <button
            type="button"
            title={path}
            aria-current={selectedPath === path ? 'page' : undefined}
            className={cx(
              'flex h-7 w-full cursor-pointer items-center gap-1.5 rounded-md px-2 text-left text-xs',
              selectedPath === path
                ? 'bg-surface-selected text-foreground'
                : 'text-foreground-secondary hover:bg-surface-hover-subtle hover:text-foreground',
            )}
            onClick={() => onSelect(path)}
          >
            <FileIcon />
            <span className="truncate">{name}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ProjectFilesTree({ files, selectedPath, onSelect }: ProjectFilesTreeProps) {
  return (
    <nav aria-label="Project files" className="min-h-0 flex-1 overflow-y-auto p-2 scrollbar-subtle">
      <DirectoryEntries node={buildTree(files)} selectedPath={selectedPath} onSelect={onSelect} />
    </nav>
  );
}
