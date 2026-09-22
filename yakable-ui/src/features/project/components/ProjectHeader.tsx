import { Icon, IconButton } from '@/shared/ui';

export interface ProjectHeaderProps {
  title: string;
  loading?: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
}

export function ProjectHeader({
  title,
  loading = false,
  expanded,
  onToggleExpanded,
}: ProjectHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-workspace px-4">
      {loading ? (
        <output className="flex min-w-0 items-center gap-1.5" aria-label="Loading session header">
          <span aria-hidden="true" className="h-4 w-24 animate-pulse rounded-full bg-skeleton" />
          <span aria-hidden="true" className="size-3 animate-pulse rounded-full bg-skeleton" />
        </output>
      ) : (
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            title={title}
            className="truncate text-sm font-semibold tracking-[-0.01em] text-foreground"
          >
            {title}
          </span>

          <Icon size={14} className="shrink-0 text-foreground-subtle">
            <path d="m7 10 5 5 5-5" />
          </Icon>
        </div>
      )}

      <IconButton
        aria-label={expanded ? 'Collapse workspace' : 'Expand workspace'}
        title={expanded ? 'Collapse workspace' : 'Expand workspace'}
        size="sm"
        onClick={onToggleExpanded}
      >
        <Icon size={17}>
          {expanded ? (
            <>
              <path d="M3 8h5V3" />
              <path d="M21 8h-5V3" />
              <path d="M3 16h5v5" />
              <path d="M21 16h-5v5" />
            </>
          ) : (
            <>
              <path d="M8 3H3v5" />
              <path d="M16 3h5v5" />
              <path d="M8 21H3v-5" />
              <path d="M16 21h5v-5" />
            </>
          )}
        </Icon>
      </IconButton>
    </header>
  );
}
