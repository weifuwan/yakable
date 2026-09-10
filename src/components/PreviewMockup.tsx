interface PreviewMockupProps {
  compact?: boolean;
  mobile?: boolean;
}

const steps = [
  {
    index: '01',
    title: 'Describe',
    body: 'Tell Yakable what you want to build in plain language.',
  },
  {
    index: '02',
    title: 'Generate',
    body: 'The coding agent turns the request into a working project.',
  },
  {
    index: '03',
    title: 'Refine',
    body: 'Keep chatting while the preview updates with each change.',
  },
];

export default function PreviewMockup({ compact = false, mobile = false }: PreviewMockupProps) {
  return (
    <div className="min-h-full bg-[#f6f5f2] text-zinc-950">
      <header
        className={`flex items-center justify-between border-b border-black/6 ${mobile ? 'px-5 py-4' : 'px-8 py-5'}`}
      >
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-zinc-950 text-sm font-bold text-white">
            Y
          </div>
          <span className="text-sm font-semibold tracking-[-0.02em]">Yakable</span>
        </div>
        {!mobile ? (
          <nav className="flex items-center gap-5 text-[11px] font-medium text-zinc-500">
            <span>Product</span>
            <span>Examples</span>
            <span>Docs</span>
          </nav>
        ) : null}
        <button
          type="button"
          className="rounded-full bg-zinc-950 px-4 py-2 text-[11px] font-semibold text-white"
        >
          Start building
        </button>
      </header>

      <main className={mobile ? 'px-5 pb-8 pt-12' : compact ? 'px-8 pb-10 pt-16' : 'px-12 pb-12 pt-20'}>
        <section className="mx-auto max-w-4xl text-center">
          <div className="mx-auto mb-5 inline-flex items-center rounded-full border border-black/10 bg-white/70 px-3 py-1 text-[10px] font-medium text-zinc-600 shadow-sm backdrop-blur">
            From idea to software, in one conversation
          </div>
          <h1
            className={`mx-auto max-w-3xl font-semibold tracking-[-0.055em] text-zinc-950 ${
              mobile ? 'text-[40px] leading-[0.98]' : compact ? 'text-[48px] leading-[0.98]' : 'text-[64px] leading-[0.96]'
            }`}
          >
            Build software by describing it.
          </h1>
          <p
            className={`mx-auto mt-5 max-w-2xl leading-6 text-zinc-500 ${mobile ? 'text-[13px]' : 'text-sm'}`}
          >
            Yakable turns natural-language ideas into working applications, then keeps improving them as you chat.
          </p>

          <div className="mx-auto mt-7 flex max-w-xl items-center gap-2 rounded-2xl border border-black/8 bg-white p-2 shadow-[0_18px_60px_rgba(24,24,27,0.10)]">
            <div className="min-w-0 flex-1 px-2 text-left text-[11px] text-zinc-400">
              Build a modern analytics dashboard for my SaaS...
            </div>
            <div className="rounded-xl bg-zinc-950 px-3 py-2 text-[10px] font-semibold text-white">Build</div>
          </div>
        </section>

        <section
          className={`mx-auto mt-12 grid max-w-4xl gap-3 ${mobile ? 'grid-cols-1' : 'grid-cols-3'}`}
        >
          {steps.map((step) => (
            <article
              key={step.index}
              className="rounded-2xl border border-black/7 bg-white/72 p-4 text-left shadow-[0_8px_30px_rgba(24,24,27,0.04)] backdrop-blur"
            >
              <div className="mb-6 text-[10px] font-semibold text-zinc-400">{step.index}</div>
              <h2 className="text-sm font-semibold tracking-[-0.02em] text-zinc-900">{step.title}</h2>
              <p className="mt-1.5 text-[11px] leading-5 text-zinc-500">{step.body}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
