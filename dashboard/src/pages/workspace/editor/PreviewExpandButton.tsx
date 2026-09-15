export function PreviewExpandButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="grid h-7 w-7 shrink-0 place-items-center rounded-full border-0 bg-transparent text-black/55 transition-[background-color,color,transform] duration-150 hover:bg-black/[0.05] hover:text-black active:scale-[0.96]"
      onClick={onClick}
      aria-label="Restore preview toolbar"
      title="Restore preview toolbar"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M13 5h6v6" />
        <path d="m19 5-7 7" />
        <path d="M11 19H5v-6" />
        <path d="m5 19 7-7" />
      </svg>
    </button>
  );
}
