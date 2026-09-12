import { useMemo, useState } from "react";

import type { ProjectListItem } from "../api";
import { editedLabel, projectTitle } from "../utils/project";
import { Icon, controlClass, iconButtonClass } from "./ui";

type ViewMode = "grid" | "list";
type ProjectFilter = "all" | "day" | "week";
type ProjectSort = "updated" | "name";

const previewVariantClasses = [
  "bg-gradient-to-br from-slate-50 via-sky-50 to-sky-200",
  "bg-gradient-to-br from-violet-50 via-indigo-50 to-violet-200",
  "bg-gradient-to-br from-emerald-50 via-teal-50 to-emerald-200",
];

function ProjectPreview({ index }: { index: number }) {
  const variantClass =
    previewVariantClasses[index % previewVariantClasses.length] ??
    previewVariantClasses[0];

  return (
    <div
      className={`absolute inset-0 grid place-items-center p-3 transition duration-200 group-hover/thumb:scale-[1.015] ${variantClass}`}
    >
      <div className="h-[82%] w-[88%] overflow-hidden rounded-lg bg-white/95 shadow-[0_5px_18px_rgba(0,0,0,0.12)]">
        <div className="flex h-[11%] items-center gap-1 border-b border-black/[0.06] pl-2">
          <span className="h-[3px] w-[3px] rounded-full bg-black/15" />
          <span className="h-[3px] w-[3px] rounded-full bg-black/15" />
          <span className="h-[3px] w-[3px] rounded-full bg-black/15" />
        </div>
        <div className="h-[89%] px-[9%] py-[7%]">
          <div className="mb-[11%] flex items-center gap-[7%]">
            <b className="grid h-2.5 w-2.5 place-items-center rounded-[3px] bg-neutral-900 text-[4px] text-white">
              Y
            </b>
            <span className="h-[3px] w-[15%] rounded-full bg-black/15" />
            <span className="h-[3px] w-[15%] rounded-full bg-black/15" />
            <span className="h-[3px] w-[15%] rounded-full bg-black/15" />
          </div>
          <div className="mx-auto mb-1.5 h-2 w-[72%] rounded-full bg-neutral-800" />
          <div className="mx-auto mb-1.5 h-1.5 w-[52%] rounded-full bg-black/25" />
          <div className="mx-auto mb-3 mt-2.5 h-2 w-[23%] rounded-full bg-neutral-700" />
          <div className="grid grid-cols-3 gap-1.5">
            <i className="h-7 rounded bg-black/[0.055]" />
            <i className="h-7 rounded bg-black/[0.055]" />
            <i className="h-7 rounded bg-black/[0.055]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({
  project,
  index,
  onOpen,
  viewMode,
}: {
  project: ProjectListItem;
  index: number;
  onOpen: (id: string) => void;
  viewMode: ViewMode;
}) {
  return (
    <article
      className={`group/card min-w-0 overflow-hidden rounded-xl border border-black/[0.09] bg-white transition hover:border-black/[0.18] ${viewMode === "list" ? "flex min-h-[92px]" : ""}`}
    >
      <button
        className={`group/thumb relative overflow-hidden border-0 bg-slate-50 p-0 text-left ${
          viewMode === "list" ? "w-40 shrink-0" : "aspect-[3/2] w-full"
        }`}
        type="button"
        onClick={() => onOpen(project.id)}
        aria-label={`Open ${projectTitle(project.id)}`}
      >
        <ProjectPreview index={index} />
        <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-lg border border-black/[0.10] bg-white/90 text-black/55 opacity-0 shadow-sm backdrop-blur transition group-hover/card:opacity-100">
          <Icon name="star" size={15} />
        </span>
      </button>

      <button
        className={`flex min-w-0 items-center gap-2 border-0 bg-white text-left ${
          viewMode === "list"
            ? "flex-1 px-4 py-3"
            : "h-[47px] w-full border-t border-black/[0.08] px-3"
        }`}
        type="button"
        onClick={() => onOpen(project.id)}
      >
        <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-[7px] border-2 border-white bg-sky-600 text-white shadow-sm">
          <Icon name="grid" size={12} />
        </span>
        <span className="min-w-0 flex-1">
          <strong className="block truncate text-sm font-medium text-[#222b2b]">
            {projectTitle(project.id)}
          </strong>
          <small className="block truncate text-[10px] text-black/45">
            Edited {editedLabel(project.updatedAt)}
          </small>
        </span>
        <span className="text-sm text-black/35 opacity-0 transition group-hover/card:opacity-100">
          •••
        </span>
      </button>
    </article>
  );
}

export function ProjectGallery({
  projects,
  loading,
  onOpen,
  title = "Recents",
}: {
  projects: ProjectListItem[];
  loading: boolean;
  onOpen: (id: string) => void;
  title?: string;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ProjectFilter>("all");
  const [sort, setSort] = useState<ProjectSort>("updated");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const visibleProjects = useMemo(() => {
    const now = Date.now();
    const maxAge =
      filter === "day"
        ? 86_400_000
        : filter === "week"
          ? 604_800_000
          : Number.POSITIVE_INFINITY;

    const filtered = projects.filter((project) => {
      const matchesSearch = projectTitle(project.id)
        .toLowerCase()
        .includes(query.trim().toLowerCase());
      const age = now - new Date(project.updatedAt).getTime();
      return matchesSearch && age <= maxAge;
    });

    return [...filtered].sort((a, b) =>
      sort === "name"
        ? projectTitle(a.id).localeCompare(projectTitle(b.id))
        : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [projects, query, filter, sort]);

  return (
    <section className="mx-auto w-full max-w-[1400px] bg-white px-6 pb-10 pt-2 lg:px-9">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="m-0 text-base font-medium text-[#202929]">{title}</h2>

        <div className="flex items-center gap-3">
          <button
            className={`${iconButtonClass} border border-black/[0.10] bg-white shadow-sm ${searchOpen ? "bg-black/[0.05] text-black" : ""}`}
            type="button"
            aria-label="Search projects"
            onClick={() => setSearchOpen((value) => !value)}
          >
            <Icon name="search" size={14} />
          </button>

          <div className="relative">
            <button
              className={`${controlClass} ${filter !== "all" ? "bg-black/[0.05]" : ""}`}
              type="button"
              onClick={() => setFilterOpen((value) => !value)}
            >
              <Icon name="sliders" size={14} />
              Filter
            </button>
            {filterOpen ? (
              <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-40 overflow-hidden rounded-xl border border-black/[0.10] bg-white p-1.5 shadow-xl">
                {(
                  [
                    ["all", "All projects"],
                    ["day", "Last 24 hours"],
                    ["week", "Last 7 days"],
                  ] as Array<[ProjectFilter, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`flex w-full rounded-lg border-0 px-3 py-2 text-left text-xs transition hover:bg-black/[0.04] ${filter === value ? "bg-black/[0.06] font-medium" : "bg-white"}`}
                    onClick={() => {
                      setFilter(value);
                      setFilterOpen(false);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <label className={`${controlClass} hidden pr-2 md:inline-flex`}>
            <select
              className="appearance-none border-0 bg-transparent pr-1 text-xs outline-none"
              value={sort}
              onChange={(event) => setSort(event.target.value as ProjectSort)}
              aria-label="Sort projects"
            >
              <option value="updated">Last Updated</option>
              <option value="name">Name</option>
            </select>
            <Icon name="chevronDown" size={13} />
          </label>

          <div
            className="inline-flex h-7 items-center gap-0.5 rounded-lg bg-black/[0.075] p-1 shadow-inner"
            role="group"
            aria-label="Project view"
          >
            <button
              className={`grid h-5 w-9 place-items-center rounded-md border-0 transition ${viewMode === "grid" ? "bg-white text-black shadow-sm" : "bg-transparent text-black/45"}`}
              type="button"
              onClick={() => setViewMode("grid")}
              aria-label="Grid view"
            >
              <Icon name="grid" size={14} />
            </button>
            <button
              className={`grid h-5 w-9 place-items-center rounded-md border-0 transition ${viewMode === "list" ? "bg-white text-black shadow-sm" : "bg-transparent text-black/45"}`}
              type="button"
              onClick={() => setViewMode("list")}
              aria-label="List view"
            >
              <Icon name="list" size={14} />
            </button>
          </div>
        </div>
      </div>

      {searchOpen ? (
        <div className="mb-4 flex h-10 items-center gap-2 rounded-xl border border-black/[0.09] bg-[#fafafa] px-3 text-black/45">
          <Icon name="search" size={16} />
          <input
            className="w-full border-0 bg-transparent text-sm text-black outline-none placeholder:text-black/35"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects"
          />
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-40 items-center justify-center text-sm text-black/45">
          Loading generated projects…
        </div>
      ) : null}

      {!loading && visibleProjects.length === 0 ? (
        <div className="flex min-h-40 flex-col items-center justify-center gap-1 text-center text-sm text-black/45">
          <strong className="text-sm font-medium text-black/70">
            No projects here yet.
          </strong>
          <span>
            Describe an idea above and Yakable will create the first one.
          </span>
        </div>
      ) : null}

      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "flex flex-col gap-3"
        }
      >
        {visibleProjects.map((project, index) => (
          <ProjectCard
            key={project.id}
            project={project}
            index={index}
            onOpen={onOpen}
            viewMode={viewMode}
          />
        ))}
      </div>
    </section>
  );
}
