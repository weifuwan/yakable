import { CreateProjectComposer } from '@/features/project';

export function DashboardPage() {
  return (
    <div className="flex min-h-full flex-col px-6">
      <div aria-hidden="true" className="min-h-10 flex-[4]" />

      <section className="w-full max-w-2xl self-center">
        <h1 className="m-0 text-center text-[28px] font-semibold tracking-[-0.035em] text-heading-foreground">
          What do you want to build?
        </h1>

        <div className="mt-8">
          <CreateProjectComposer />
        </div>
      </section>

      <div aria-hidden="true" className="min-h-10 flex-[6]" />
    </div>
  );
}

export { DashboardPage as Dashboard };
