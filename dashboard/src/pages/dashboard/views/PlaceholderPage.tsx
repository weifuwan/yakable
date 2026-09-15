export function PlaceholderPage({
  title,
  description = "This page is ready for future content.",
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex min-h-[360px] flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <h1 className="m-0 text-2xl font-semibold tracking-[-0.025em] text-[#182020]">
          {title}
        </h1>
        <p className="mb-0 mt-2 text-sm leading-6 text-black/45">
          {description}
        </p>
      </div>
    </div>
  );
}
