import { useState } from "react";

import type { ProjectListItem } from "../../../api";
import {
  buildCreationSteps,
  creationChangedFileCount,
  creationPreviewCopy,
  latestCreationMessage,
} from "../../../building-workspace-state";
import type { ProjectCreationStatus } from "../../../create-project";
import { Sidebar } from "../../../components/Layout";
import { Icon } from "../../../components/ui";
import { projectTitle } from "../../../utils/project";
import type { ActiveProject } from "../editor/types";
import { BuildPreview } from "./BuildPreview";
import { BuildStepIcon } from "./BuildStepIcon";

function projectPath(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
}

export function BuildingWorkspace({
  projectId,
  projects,
  creation,
  readyProject,
  error,
  onRetry,
  onPreviewReady,
  onNavigate,
}: {
  projectId: string;
  projects: ProjectListItem[];
  creation: ProjectCreationStatus;
  readyProject: ActiveProject | null;
  error: string;
  onRetry: () => Promise<void>;
  onPreviewReady: () => void;
  onNavigate: (path: string) => void;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState("");
  const steps = buildCreationSteps(creation);
  const latestMessage = latestCreationMessage(creation);
  const changedFiles = creationChangedFileCount(creation);
  const preview = creationPreviewCopy(creation.project.status, error || retryError);
  const failed = Boolean(error) || Boolean(retryError) || creation.project.status === "FAILED";
  const activeStep = steps.find((step) => step.status === "active");
  const pathname = projectPath(projectId);
  const buildReady = Boolean(readyProject);

  async function retryBuild() {
    if (retrying) return;
    setRetrying(true);
    setRetryError("");
    try {
      await onRetry();
    } catch (caught) {
      setRetryError(
        caught instanceof Error ? caught.message : "Yakable could not retry this build.",
      );
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="flex h-screen min-h-screen overflow-hidden bg-[#f5f6f6] font-sans text-[#20201e] antialiased">
      <style>{`
        @keyframes yakable-building-shimmer {
          0% { background-position: 180% 0; }
          100% { background-position: -180% 0; }
        }
        .yakable-build-shimmer {
          background: linear-gradient(90deg, rgba(32,32,30,.055) 20%, rgba(32,32,30,.095) 36%, rgba(32,32,30,.055) 52%);
          background-size: 240% 100%;
          animation: yakable-building-shimmer 1.8s ease-in-out infinite;
        }
      `}</style>

      <div
        className={`shrink-0 overflow-hidden transition-[width] duration-[220ms] [transition-timing-function:cubic-bezier(0.32,0.72,0,1)] ${sidebarCollapsed ? "w-0" : "w-[245px]"}`}
        aria-hidden={sidebarCollapsed}
      >
        <div className="h-full w-[245px]">
          <Sidebar
            pathname={pathname}
            onNavigate={onNavigate}
            projects={projects}
            activeProjectId={projectId}
          />
        </div>
      </div>

      <div className="m-2 ml-0 flex min-w-0 flex-1 overflow-hidden rounded-2xl border border-black/[0.09] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.05)]">
        <section className="flex min-w-[360px] w-[45.3%] shrink-0 flex-col border-r border-black/[0.08] bg-white max-[900px]:min-w-0 max-[900px]:w-full max-[900px]:border-r-0">
          <div className="flex h-12 shrink-0 items-center justify-between border-b border-black/[0.07] px-2">
            <div className="flex min-w-0 items-center gap-2">
              <button
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-0 bg-transparent text-black/55 transition hover:bg-black/[0.05] hover:text-black"
                type="button"
                onClick={() => setSidebarCollapsed((value) => !value)}
                aria-label={sidebarCollapsed ? "Expand project sidebar" : "Collapse project sidebar"}
              >
                <Icon name="panel" size={15} />
              </button>
              <strong className="truncate text-sm font-medium text-black/75">
                {creation.project.name || projectTitle(projectId)}
              </strong>
            </div>
            <span className={`mr-1 inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium ${failed ? "bg-rose-50 text-rose-700" : buildReady ? "bg-emerald-50 text-emerald-700" : "bg-[#6d5dfc]/[0.07] text-[#5b4de0]"}`}>
              {!failed && !buildReady ? <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#6d5dfc]" /> : null}
              {failed ? "Paused" : buildReady ? "Preview ready" : "Building"}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 max-[1100px]:px-4">
            <div className="mx-auto w-full max-w-[620px]">
              <div className="flex items-center gap-2 text-xs font-medium text-black/45">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-black/[0.06] text-[10px] font-semibold text-black/55">Y</span>
                You
              </div>
              <div className="ml-8 mt-2 whitespace-pre-wrap rounded-2xl rounded-tl-md bg-[#f3f3f1] px-4 py-3 text-[13px] leading-6 text-black/78">
                {creation.project.prompt}
              </div>

              <div className="mt-7 flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#6d5dfc] text-white shadow-[0_2px_8px_rgba(109,93,252,0.22)]">
                  <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
                    <path d="M10 2.5c.8 3 2.5 4.7 5.5 5.5-3 .8-4.7 2.5-5.5 5.5-.8-3-2.5-4.7-5.5-5.5 3-.8 4.7-2.5 5.5-5.5Z" />
                    <path d="M15.5 12.5c.35 1.3 1.2 2.15 2.5 2.5-1.3.35-2.15 1.2-2.5 2.5-.35-1.3-1.2-2.15-2.5-2.5 1.3-.35 2.15-1.2 2.5-2.5Z" opacity=".7" />
                  </svg>
                </span>
                <span className="text-xs font-semibold text-black/70">Yakable</span>
                {!failed && !buildReady ? <span className="text-[11px] text-black/35">is working</span> : null}
                {buildReady ? <span className="text-[11px] text-emerald-700/65">built the first version</span> : null}
              </div>

              <div className="ml-8 mt-3">
                <div className="text-[14px] font-semibold tracking-[-0.01em] text-[#20201e]">
                  {failed
                    ? "The build stopped before it was ready"
                    : buildReady
                      ? "Your first version is ready"
                      : activeStep?.label || preview.title}
                </div>
                <p className={`mb-0 mt-1 text-[12px] leading-5 ${failed ? "text-rose-700/75" : "text-black/45"}`}>
                  {retryError || error || latestMessage || preview.detail}
                </p>

                <div className="mt-5 rounded-2xl border border-black/[0.07] bg-[#fbfbfa] px-4 py-3.5">
                  {steps.map((step, index) => (
                    <div key={step.state} className="relative flex min-h-[38px] gap-3">
                      {index < steps.length - 1 ? (
                        <span className={`absolute left-[8.5px] top-[18px] h-[calc(100%-1px)] w-px ${step.status === "complete" ? "bg-black/18" : "bg-black/[0.07]"}`} aria-hidden="true" />
                      ) : null}
                      <BuildStepIcon status={step.status} />
                      <div className="min-w-0 pb-3">
                        <div className={`text-[12px] leading-[18px] ${step.status === "active" ? "font-semibold text-black/78" : step.status === "failed" ? "font-semibold text-rose-700" : step.status === "complete" ? "font-medium text-black/58" : "font-medium text-black/30"}`}>
                          {step.label}
                        </div>
                        {step.status === "active" && step.message ? (
                          <div className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-black/38">{step.message}</div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>

                {changedFiles > 0 ? (
                  <div className="mt-3 flex items-center gap-1.5 text-[11px] text-black/38">
                    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 3.5h6l4 4v9H5z" />
                      <path d="M11 3.5v4h4" />
                    </svg>
                    {changedFiles} {changedFiles === 1 ? "file" : "files"} prepared so far
                  </div>
                ) : null}

                {failed ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#20201e] px-3 text-xs font-semibold text-white transition hover:bg-black disabled:cursor-wait disabled:opacity-60"
                      type="button"
                      disabled={retrying}
                      onClick={() => void retryBuild()}
                    >
                      {retrying ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M15.5 8A6 6 0 1 0 16 11" />
                          <path d="M15.5 4v4h-4" />
                        </svg>
                      )}
                      {retrying ? "Retrying…" : "Retry build"}
                    </button>
                    <button
                      className="inline-flex h-8 items-center rounded-lg border border-black/[0.09] bg-white px-3 text-xs font-medium text-black/55 transition hover:bg-black/[0.025] hover:text-black/75"
                      type="button"
                      onClick={() => onNavigate("/dashboard")}
                    >
                      Back to dashboard
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-black/[0.06] p-3">
            <div className="flex h-11 items-center rounded-xl border border-black/[0.08] bg-[#fafaf9] px-3 text-xs text-black/28">
              {failed
                ? "Retry the build to start a fresh create run."
                : buildReady
                  ? "Opening the editor…"
                  : "Continue editing once the first preview is ready…"}
              <span className="ml-auto grid h-7 w-7 place-items-center rounded-full bg-black/[0.05] text-black/22">
                <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M10 15V5M6.5 8.5 10 5l3.5 3.5" />
                </svg>
              </span>
            </div>
          </div>
        </section>

        <section className="min-w-0 flex-1 max-[900px]:hidden">
          <BuildPreview
            title={preview.title}
            eyebrow={preview.eyebrow}
            detail={preview.detail}
            failed={failed}
            readyProject={readyProject}
            onPreviewReady={onPreviewReady}
          />
        </section>
      </div>
    </div>
  );
}
