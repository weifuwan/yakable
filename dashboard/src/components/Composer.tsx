import { FormEvent, useEffect, useRef, useState } from "react";

import { Icon, type IconName, iconButtonClass } from "./ui";

type DesignSystemId =
  | "base"
  | "wireframe"
  | "shadcn"
  | "chakra"
  | "mantine"
  | "mui";

type DesignSystemOption = {
  id: DesignSystemId;
  label: string;
};

const designSystemOptions: DesignSystemOption[] = [
  { id: "base", label: "Base" },
  { id: "wireframe", label: "Wireframe" },
  { id: "shadcn", label: "Shadcn" },
  { id: "chakra", label: "Chakra" },
  { id: "mantine", label: "Mantine" },
  { id: "mui", label: "MUI" },
];

function DesignSystemMark({
  type,
  size = 14,
}: {
  type: DesignSystemId;
  size?: number;
}) {
  if (type === "base") {
    return (
      <span
        className="relative shrink-0 overflow-hidden rounded-[3px] bg-[#e7f8ef]"
        style={{ width: size, height: size }}
      >
        <span className="absolute bottom-[2px] left-[2px] h-[5px] w-[6px] rotate-[-12deg] rounded-[1px] bg-emerald-300" />
        <span className="absolute bottom-[2px] right-[1px] h-[7px] w-[7px] rotate-[20deg] rounded-[1px] bg-sky-200" />
      </span>
    );
  }

  if (type === "wireframe") {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-[3px] border border-black/30 bg-white"
        style={{ width: size, height: size }}
      >
        <span className="grid h-[8px] w-[9px] grid-cols-2 gap-px">
          <i className="border-r border-black/25" />
          <i />
          <i className="col-span-2 border-t border-black/25" />
        </span>
      </span>
    );
  }

  if (type === "shadcn") {
    return (
      <span
        className="relative shrink-0 rounded-full bg-black"
        style={{ width: size, height: size }}
      >
        <span className="absolute left-[4px] top-[7px] h-px w-[7px] -rotate-45 bg-white" />
        <span className="absolute left-[6px] top-[8px] h-px w-[5px] -rotate-45 bg-white" />
      </span>
    );
  }

  if (type === "chakra") {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-[#4cc5c9] text-[9px] font-bold text-white"
        style={{ width: size, height: size }}
      >
        ↗
      </span>
    );
  }

  if (type === "mantine") {
    return (
      <span
        className="grid shrink-0 place-items-center rounded-full bg-[#329af0] text-[9px] font-bold text-white"
        style={{ width: size, height: size }}
      >
        ✦
      </span>
    );
  }

  return (
    <span
      className="grid shrink-0 place-items-center rounded-[3px] bg-[#e8f4ff] text-[9px] font-extrabold text-[#1976d2]"
      style={{ width: size, height: size }}
    >
      M
    </span>
  );
}

function DesignSystemPicker({ disabled }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DesignSystemId>("base");
  const rootRef = useRef<HTMLDivElement>(null);

  const activeSystem =
    designSystemOptions.find((item) => item.id === selected) ??
    designSystemOptions[0];

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        aria-label="Select design system"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className="
    inline-flex h-6 cursor-pointer appearance-none items-center
    overflow-hidden rounded-full
    border border-solid border-[#e6f5fb]
    bg-white p-0
    text-[11px] font-medium text-[#263030]
    transition-colors
    disabled:cursor-not-allowed disabled:opacity-50
  "
      >
        <span
          className="
      hidden h-full items-center
      bg-[#e6f5fb]
      px-2.5
      tracking-[0.01em]
      text-[#036b94]
      md:inline-flex
    "
        >
          Design System
        </span>

        <span
          className="
      inline-flex h-full items-center gap-1
      border-0 border-l border-solid border-[#e6f5fb]
      bg-white
      px-2
      text-[#263030]
      transition-colors duration-100
      hover:bg-black/[0.025]
      max-md:pl-4
    "
        >
          <DesignSystemMark type={selected} size={14} />

          <span className="max-w-[160px] truncate">{activeSystem.label}</span>

          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={`h-3.5 w-3.5 shrink-0 opacity-70 transition-transform duration-150 ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          >
            <path
              d="M3.13523 6.15803C3.3241 5.95657 3.64052 5.94637 3.84197 6.13523L7.5 9.56464L11.158 6.13523C11.3595 5.94637 11.6759 5.95657 11.8648 6.15803C12.0536 6.35949 12.0434 6.67591 11.842 6.86477L7.84197 10.6148C7.64964 10.7951 7.35036 10.7951 7.15803 10.6148L3.15803 6.86477C2.95657 6.67591 2.94637 6.35949 3.13523 6.15803Z"
              fill="currentColor"
              fillRule="evenodd"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {open ? (
        <div
          className="
            absolute left-0 top-[calc(100%+6px)] z-[100]
            w-[182px]
            overflow-hidden
            rounded-[14px]
            border border-black/[0.14]
            bg-white
            p-[6px]
            text-[#263030]
            shadow-[0_12px_30px_rgba(15,23,42,0.16)]
          "
          role="menu"
          aria-label="Design systems"
        >
          <button
            className="
              flex h-7 w-full items-center gap-2
              rounded-[7px]
              border-0 bg-transparent
              px-2
              text-left text-[12px] font-medium
              text-[#263030]
              transition
              hover:bg-black/[0.045]
            "
            type="button"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <Icon name="plus" size={15} />
            <span>Create a Design System</span>
          </button>

          <div className="mx-1 my-[5px] h-px bg-black/[0.12]" />

          <div className="px-2 pb-1 pt-[2px] text-[11px] font-medium text-black/45">
            Default Design Systems
          </div>

          <div className="flex flex-col">
            {designSystemOptions.map((system) => {
              const checked = selected === system.id;

              return (
                <button
                  key={system.id}
                  className={`
                    flex h-7 w-full items-center gap-2
                    rounded-[7px]
                    border-0
                    px-2
                    text-left text-[12px]
                    transition
                    ${
                      checked
                        ? "bg-black/[0.025] text-[#172020]"
                        : "bg-transparent text-[#344040] hover:bg-black/[0.045]"
                    }
                  `}
                  type="button"
                  role="menuitemradio"
                  aria-checked={checked}
                  onClick={() => {
                    setSelected(system.id);
                    setOpen(false);
                  }}
                >
                  <DesignSystemMark type={system.id} size={14} />

                  <span className="min-w-0 flex-1 truncate">
                    {system.label}
                  </span>

                  {checked ? (
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M3.5 8.2 6.4 11l6.1-6.2"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Composer({
  onCreate,
  busy,
}: {
  onCreate: (prompt: string) => Promise<void>;
  busy: boolean;
}) {
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState("");

  const quickActions: Array<{
    label: string;
    icon: IconName;
    prompt: string;
  }> = [
    {
      label: "Recreate a screenshot",
      icon: "image",
      prompt:
        "Recreate a polished web page from a screenshot with a clean responsive layout.",
    },
    {
      label: "Import from GitHub",
      icon: "github",
      prompt:
        "Create a polished frontend for an existing GitHub project and keep the implementation simple.",
    },
    {
      label: "Import from Figma",
      icon: "figma",
      prompt:
        "Turn a Figma-style product design into a responsive React interface.",
    },
    {
      label: "Create a landing page",
      icon: "template",
      prompt:
        "Build a clean SaaS landing page with a hero, feature section, and pricing cards.",
    },
  ];

  const canSubmit = Boolean(prompt.trim()) && !busy;

  /**
   * 统一提交入口
   *
   * 无论：
   * - 点击发送按钮
   * - Enter 发送
   *
   * 最终都走这里。
   */
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const request = prompt.trim();

    if (!request || busy) {
      return;
    }

    setError("");

    try {
      await onCreate(request);
      setPrompt("");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Project creation failed.",
      );
    }
  }

  /**
   * textarea 键盘事件
   *
   * Enter         -> 发送
   * Shift + Enter -> 换行
   *
   * 中文输入法正在选词时，
   * Enter 不触发发送。
   */
  function handleKeyDown(event: any) {
    if (event.key !== "Enter") {
      return;
    }

    // Shift + Enter：正常换行
    if (event.shiftKey) {
      return;
    }

    // 中文 / 日文 / 韩文输入法组合输入过程中，
    // Enter 通常用于确认候选词，不能触发发送。
    if (event.nativeEvent.isComposing) {
      return;
    }

    // 阻止 textarea 默认换行
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    // 不直接调用 onCreate。
    // 统一触发 form submit，
    // 保证按钮点击和 Enter 使用同一套提交逻辑。
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <div className="relative w-full">
      <form
        className="
          relative z-10
          flex min-h-[104px] w-full flex-col
          rounded-2xl
          border border-black/[0.11]
          bg-white
          px-3 pb-2 pt-2
          shadow-[0_2px_8px_rgba(15,23,42,0.07)]
          transition
          focus-within:border-black/[0.18]
          focus-within:shadow-[0_6px_24px_rgba(15,23,42,0.10)]
        "
        onSubmit={submit}
      >
        <textarea
          className="
            min-h-12
            max-h-40
            w-full
            resize-none
            overflow-y-auto
            border-0
            bg-transparent
            px-1
            py-2
            text-[15px]
            leading-6
            text-[#1e2525]
            outline-none
            placeholder:text-black/35
            disabled:cursor-wait
            disabled:opacity-60
          "
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);

            if (error) {
              setError("");
            }
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask Yakable to build anything..."
          aria-label="Describe what you want to build"
          rows={2}
          disabled={busy}
        />

        <div className="mt-1 flex min-h-8 items-center justify-between gap-2">
          {/* 左侧工具 */}
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            <button
              className={iconButtonClass}
              type="button"
              aria-label="Add attachment"
              disabled={busy}
            >
              <Icon name="plus" size={18} />
            </button>

            <button
              className={iconButtonClass}
              type="button"
              aria-label="Commands"
              disabled={busy}
            >
              <Icon name="command" size={18} />
            </button>

            <DesignSystemPicker disabled={busy} />
          </div>

          {/* 右侧工具 */}
          <div className="flex shrink-0 items-center gap-1">
            <button
              className="
    inline-flex h-7 items-center gap-1
    rounded-lg
    border-0
    bg-transparent
    px-2
    text-xs
    text-black/60
    cursor-pointer
    transition
    hover:bg-black/[0.04]
    hover:text-black
    disabled:cursor-default
    disabled:opacity-40
  "
              type="button"
              disabled={busy}
            >
              Auto
              <Icon name="chevronDown" size={13} />
            </button>

            <button
              className={iconButtonClass}
              type="button"
              aria-label="Voice input"
              disabled={busy}
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                xmlns="http://www.w3.org/2000/svg"
                className="shrink-0 size-5"
                aria-hidden="true"
                data-default-size=""
                data-button-icon=""
                style={{width: 16, height: 16}}
              >
                <path
                  d="M19.348 13.001c0.517 0 0.89 0.5 0.683 0.975a8.753 8.753 0 0 1-7.28 5.24V21.25h1.25a0.75 0.75 0 0 1 0 1.5h-4a0.75 0.75 0 0 1 0-1.5h1.25v-2.032a8.754 8.754 0 0 1-7.281-5.242c-0.206-0.476 0.165-0.975 0.683-0.975a0.83 0.83 0 0 1 0.745 0.499 7.253 7.253 0 0 0 13.205 0 0.83 0.83 0 0 1 0.745-0.499Z"
                  fill="currentColor"
                ></path>
                <path
                  fill-rule="evenodd"
                  clip-rule="evenodd"
                  d="M12 1.75a4.75 4.75 0 0 1 4.75 4.75v4a4.75 4.75 0 0 1-9.5 0v-4A4.75 4.75 0 0 1 12 1.75Zm0 1.5a3.25 3.25 0 0 0-3.25 3.25v4a3.25 3.25 0 0 0 6.5 0v-4a3.25 3.25 0 0 0-3.25-3.25Z"
                  fill="currentColor"
                ></path>
              </svg>
            </button>

            {/* 发送按钮 */}
            <button
              className={`
    grid h-9 w-9
    place-items-center
    rounded-full
    border-0
    bg-[#001617]
    text-white
    cursor-pointer
    shadow-[0_1px_2px_rgba(0,0,0,0.16)]
    transition
    hover:bg-[#1c2424]
    disabled:cursor-default
    ${busy ? "opacity-100" : "disabled:opacity-30"}
  `}
              type="submit"
              disabled={!canSubmit}
              aria-label={busy ? "Creating project" : "Send"}
              aria-busy={busy}
            >
              {busy ? (
                <span
                  className="
        h-4 w-4
        animate-spin
        rounded-full
        border-2
        border-white/35
        border-t-white
      "
                  aria-hidden="true"
                />
              ) : (
                <span className="flex items-center" aria-hidden="true">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 15 15"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M7.14645 2.14645C7.34171 1.95118 7.65829 1.95118 7.85355 2.14645L11.8536 6.14645C12.0488 6.34171 12.0488 6.65829 11.8536 6.85355C11.6583 7.04882 11.3417 7.04882 11.1464 6.85355L8 3.70711L8 12.5C8 12.7761 7.77614 13 7.5 13C7.22386 13 7 12.7761 7 12.5L7 3.70711L3.85355 6.85355C3.65829 7.04882 3.34171 7.04882 3.14645 6.85355C2.95118 6.65829 2.95118 6.34171 3.14645 6.14645L7.14645 2.14645Z"
                      fill="currentColor"
                      fillRule="evenodd"
                      clipRule="evenodd"
                    />
                  </svg>
                </span>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* 快捷操作 */}
      <div
        className="
          mt-3
          hidden
          flex-wrap
          justify-center
          gap-2
          px-2
          sm:flex
        "
        aria-label="Prompt shortcuts"
      >
        {quickActions.map((action) => (
          <button
            key={action.label}
            className="
              inline-flex h-7 shrink-0
              items-center gap-1.5
              rounded-full
              border border-black/[0.10]
              bg-white
              px-3
              text-xs
              font-normal
              text-[#344040]
              shadow-[0_1px_2px_rgba(15,23,42,0.04)]
              transition
              hover:border-black/[0.18]
              hover:bg-black/[0.02]
              disabled:opacity-40
            "
            type="button"
            onClick={() => {
              setPrompt(action.prompt);
              setError("");
            }}
            disabled={busy}
          >
            <Icon name={action.icon} size={14} />

            {action.label}
          </button>
        ))}
      </div>

      {/* 错误信息 */}
      {error ? (
        <div
          className="
            absolute
            left-1/2
            top-[calc(100%+12px)]
            z-20
            max-w-[92%]
            -translate-x-1/2
            rounded-full
            bg-rose-50
            px-3
            py-2
            text-[11px]
            text-rose-700
            shadow-lg
          "
          role="alert"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
