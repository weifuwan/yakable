import { FormEvent, useState } from "react";

import { editProject } from "../api";
import { Icon } from "../components/ui";

export type ActiveProject = {
  id: string;
  title: string;
  previewUrl: string;
  summary?: string;
  model?: string;
};

type ChatMessage = {
  role: "user" | "assistant" | "error";
  content: string;
};

const messageRoleClasses: Record<ChatMessage["role"], string> = {
  user: "self-end rounded-br-md bg-[#202020] text-white",
  assistant: "self-start rounded-bl-md bg-[#f5f5f3] text-[#4d4d49]",
  error: "self-start bg-rose-50 text-rose-700",
};

export function Workspace({
  project,
  onBack,
}: {
  project: ActiveProject;
  onBack: () => void;
}) {
  const [previewUrl, setPreviewUrl] = useState(project.previewUrl);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        project.summary ||
        "Project is running. Tell Yakable what you want to change.",
    },
  ]);

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    const request = prompt.trim();
    if (!request || busy) return;

    setPrompt("");
    setMessages((current) => [...current, { role: "user", content: request }]);
    setBusy(true);

    try {
      const result = await editProject(project.id, request);
      setPreviewUrl(result.previewUrl);
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: `${result.summary}\nChanged: ${result.changedFiles.join(", ")}`,
        },
      ]);
    } catch (caught) {
      setMessages((current) => [
        ...current,
        {
          role: "error",
          content: caught instanceof Error ? caught.message : "Edit failed.",
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function refreshPreview() {
    const url = new URL(previewUrl);
    url.searchParams.set("clientRefresh", String(Date.now()));
    setPreviewUrl(url.toString());
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f3f3f1] font-sans text-[#1e2828] antialiased">
      <header className="grid h-[52px] shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-4 border-b border-black/[0.09] bg-[#fafaf8]/95 px-3 backdrop-blur-xl max-[820px]:grid-cols-[auto_1fr_auto]">
        <button
          className="inline-flex h-8 items-center gap-1.5 justify-self-start rounded-lg border-0 bg-transparent px-2.5 text-xs text-black/60 transition hover:bg-black/[0.05] hover:text-black"
          type="button"
          onClick={onBack}
        >
          <Icon name="back" size={17} />
          <span className="max-[820px]:hidden">Dashboard</span>
        </button>

        <div className="flex min-w-0 items-center gap-2 text-[13px] max-[820px]:justify-center">
          <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-600 text-[9px] font-bold text-white">
            Y
          </span>
          <strong className="max-w-80 truncate font-semibold">
            {project.title}
          </strong>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">
            <i className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Live
          </span>
        </div>

        <div className="flex items-center gap-1 justify-self-end">
          <button
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border-0 bg-transparent px-2.5 text-xs text-black/60 transition hover:bg-black/[0.05] hover:text-black"
            type="button"
            onClick={refreshPreview}
          >
            <Icon name="refresh" size={16} />
            <span className="max-[820px]:hidden">Refresh</span>
          </button>
          <a
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-black/60 no-underline transition hover:bg-black/[0.05] hover:text-black"
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Icon name="external" size={16} />
            <span className="max-[820px]:hidden">Open</span>
          </a>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(320px,390px)_minmax(0,1fr)] gap-2 p-2 max-[820px]:grid-cols-1 max-[820px]:grid-rows-[minmax(260px,42%)_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-black/[0.09] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.025)]">
          <div className="flex h-[46px] shrink-0 items-center justify-between border-b border-black/[0.07] px-4">
            <span className="text-[13px] font-semibold">Build</span>
            <small className="text-[10px] text-black/45">
              {project.model || "DeepSeek"}
            </small>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3.5 py-4">
            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={`max-w-[92%] whitespace-pre-wrap rounded-[14px] px-3 py-2.5 text-xs leading-5 ${messageRoleClasses[message.role]}`}
              >
                {message.content.split("\n").map((line, lineIndex) => (
                  <p className="m-0" key={`${line}-${lineIndex}`}>
                    {line}
                  </p>
                ))}
              </div>
            ))}

            {busy ? (
              <div className="flex max-w-[92%] items-center gap-2 self-start rounded-[14px] rounded-bl-md bg-[#f5f5f3] px-3 py-2.5 text-xs text-[#4d4d49]">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/15 border-t-black/70" />
                Updating the existing project…
              </div>
            ) : null}
          </div>

          <form
            className="m-2.5 shrink-0 rounded-2xl border border-black/[0.10] bg-[#fbfbfa] p-2.5 shadow-[0_5px_18px_rgba(0,0,0,0.04)]"
            onSubmit={submitEdit}
          >
            <textarea
              className="min-h-16 w-full resize-none border-0 bg-transparent text-xs leading-5 text-[#20201e] outline-none placeholder:text-black/35"
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Ask Yakable to change this project…"
              rows={3}
              disabled={busy}
            />
            <div className="flex items-center justify-between pt-1 text-[10px] text-black/45">
              <span>Prompt → Patch</span>
              <button
                className="grid h-[30px] w-[30px] place-items-center rounded-full border-0 bg-[#171717] text-white disabled:cursor-default disabled:opacity-25"
                type="submit"
                disabled={!prompt.trim() || busy}
              >
                <Icon name="send" size={17} />
              </button>
            </div>
          </form>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-[14px] border border-black/[0.09] bg-[#ececea] shadow-[0_4px_16px_rgba(0,0,0,0.025)]">
          <div className="flex h-[38px] shrink-0 items-center gap-2 border-b border-black/[0.08] bg-[#f8f8f6] px-3.5 text-[10px] text-black/45">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="truncate">
              {previewUrl.replace(/^https?:\/\//, "").split("?")[0]}
            </span>
          </div>
          <iframe
            className="min-h-0 w-full flex-1 border-0 bg-white"
            key={previewUrl}
            title={`${project.title} preview`}
            src={previewUrl}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            referrerPolicy="no-referrer"
          />
        </section>
      </div>
    </div>
  );
}
