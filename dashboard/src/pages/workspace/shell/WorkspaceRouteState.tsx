import { Icon } from "../../../components/ui";
import { projectTitle } from "../../../utils/project";

export function WorkspaceRouteState({
  projectId,
  error,
  sidebarCollapsed,
  onToggleSidebar,
  onPeekEnter,
  onPeekLeave,
}: {
  projectId: string;
  error: string;
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  onPeekEnter: () => void;
  onPeekLeave: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f6f6f4] font-sans text-[#20201e]">
      <div className="flex h-12 shrink-0 items-center gap-2 px-2">
        <button
          className="group relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border-0 bg-transparent text-black/55 transition-colors duration-150 hover:bg-black/[0.05] hover:text-black"
          type="button"
          aria-label={sidebarCollapsed ? "Expand project sidebar" : "Collapse project sidebar"}
          onClick={onToggleSidebar}
          onPointerEnter={sidebarCollapsed ? onPeekEnter : undefined}
          onPointerLeave={sidebarCollapsed ? onPeekLeave : undefined}
        >
          <span className="absolute inset-0 grid place-items-center transition-all duration-150 ease-out group-hover:-translate-x-0.5 group-hover:scale-90 group-hover:opacity-0">
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 7h14M5 12h14M5 17h14" />
            </svg>
          </span>
          <span className="absolute inset-0 grid translate-x-0.5 scale-90 place-items-center opacity-0 transition-all duration-150 ease-out group-hover:translate-x-0 group-hover:scale-100 group-hover:opacity-100">
            <Icon name="panel" size={15} />
          </span>
        </button>
        <strong className="truncate text-sm font-medium text-black/75">
          {projectTitle(projectId)}
        </strong>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <div className="flex max-w-md flex-col items-center gap-3 text-center">
          {error ? null : (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-black/15 border-t-black/70" />
          )}
          <strong className="text-sm font-semibold">
            {error ? "Unable to open project" : "Opening project…"}
          </strong>
          <p
            className={`m-0 text-xs leading-5 ${
              error ? "text-rose-700" : "text-black/45"
            }`}
          >
            {error || projectId}
          </p>
        </div>
      </div>
    </div>
  );
}
