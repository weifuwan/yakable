import {
  Icon,
  IconButton,
} from '@/shared/ui';

export interface ProjectHeaderProps {
  title: string;
  expanded: boolean;
  onToggleExpanded: () => void;
}

export function ProjectHeader({
  title,
  expanded,
  onToggleExpanded,
}: ProjectHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between bg-white px-4">
      <div className="flex min-w-0 items-center gap-1.5">
        <span
          title={title}
          className="truncate text-sm font-semibold tracking-[-0.01em] text-[#20201e]"
        >
          {title}
        </span>

        <Icon size={14} className="shrink-0 text-black/40">
          <path d="m7 10 5 5 5-5" />
        </Icon>
      </div>

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
