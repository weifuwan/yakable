import { CreateProjectComposer } from '@/features/project';

export function DashboardPage() {
  return (
    <div className="flex min-h-full justify-center px-6 pt-[27vh] pb-16">
      <section className="w-full max-w-[700px]">
        <h1 className="m-0 text-center text-[28px] font-semibold tracking-[-0.035em] text-[#151515]">
          What do you want to build?
        </h1>

        <div className="mt-8">
          <CreateProjectComposer />
        </div>
      </section>
    </div>
  );
}

export { DashboardPage as Dashboard };
