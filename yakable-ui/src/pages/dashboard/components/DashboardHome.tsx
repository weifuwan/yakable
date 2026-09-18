import type { ProjectListItem } from "@/features/project/model/types";
import { Composer } from "@/features/project/components/Composer";
import { ProjectGallery } from "@/features/project/components/ProjectGallery";

export function DashboardHome({
  projects,
  loading,
  creating,
  createError,
  onCreate,
  onOpen,
}: {
  projects: ProjectListItem[];
  loading: boolean;
  creating: boolean;
  createError: string;
  onCreate: (prompt: string) => Promise<void>;
  onOpen: (id: string) => Promise<void>;
}) {
  return (
    <>
      <section className="relative flex min-h-[492px] shrink-0 items-center justify-center overflow-hidden px-5 py-16">
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#ffffff_0%,#ffffff_14%,#fafbff_24%,#eef1ff_34%,#ffffff_48%,#ffffff_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-64 bg-gradient-to-b from-transparent via-white/40 to-white" />
        </div>

        <div className="relative z-10 flex w-full max-w-[700px] flex-col items-center text-center">
          <h1 className="mb-3 text-[34px] font-semibold tracking-[-0.035em] text-[#182020] max-sm:text-[28px]">
            Let&apos;s build something.
          </h1>
          <Composer onCreate={onCreate} busy={creating} />
          {createError ? (
            <div
              className="mt-3 w-full rounded-xl border border-red-200 bg-red-50/90 px-4 py-3 text-left"
              role="alert"
            >
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-red-700/70">
                Request paused
              </div>
              <p className="m-0 text-sm leading-6 text-red-800/80">
                {createError}
              </p>
              <p className="mb-0 mt-1 text-xs leading-5 text-red-700/60">
                Your Yakable session is still available. You can submit the prompt again without restarting the app.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <ProjectGallery
        projects={projects}
        loading={loading}
        onOpen={(id) => void onOpen(id)}
        title="Recents"
      />
    </>
  );
}
