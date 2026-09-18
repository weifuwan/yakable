import { useEffect, useState } from "react";
import {
  createProject,
  getDefaultProject,
  type Project,
} from "./project";
import {
  listWorkspaceFiles,
  readWorkspaceFile,
  type WorkspaceEntry,
} from "./workspace";

type ChatMessage = {
  id: number;
  role: "assistant" | "user";
  content: string;
};

type WorkspaceSnapshot = {
  entries: WorkspaceEntry[];
  selectedPath: string | null;
  showCodeWorkspace: boolean;
};

const indentClasses = [
  "pl-3.5",
  "pl-[30px]",
  "pl-[46px]",
  "pl-[62px]",
  "pl-[78px]",
];

const initialMessages: ChatMessage[] = [
  {
    id: 1,
    role: "assistant",
    content: "Tell me what you want to build.",
  },
];

function App() {
  const [project, setProject] = useState<Project | null>(null);
  const [entries, setEntries] = useState<WorkspaceEntry[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [prompt, setPrompt] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [showCodeWorkspace, setShowCodeWorkspace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setIsLoadingWorkspace(true);

    getDefaultProject()
      .then(async (currentProject) => {
        const snapshot = await loadWorkspaceSnapshot(currentProject.id);

        if (cancelled) return;

        setProject(currentProject);
        applyWorkspaceSnapshot(snapshot);
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Failed to load workspace",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingWorkspace(false);
        }
      });

    return () => {
      cancelled = true;
    };

    function applyWorkspaceSnapshot(snapshot: WorkspaceSnapshot): void {
      setEntries(snapshot.entries);
      setSelectedPath(snapshot.selectedPath);
      setShowCodeWorkspace(snapshot.showCodeWorkspace);

      if (!snapshot.showCodeWorkspace) {
        setContent("");
      }
    }
  }, []);

  useEffect(() => {
    if (!project || !selectedPath || !showCodeWorkspace) {
      setContent("");
      return;
    }

    let cancelled = false;
    setError(null);

    readWorkspaceFile(project.id, selectedPath)
      .then((file) => {
        if (!cancelled) {
          setContent(file.content);
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(
            reason instanceof Error ? reason.message : "Failed to read file",
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [project?.id, selectedPath, showCodeWorkspace]);

  async function handleSubmit(): Promise<void> {
    const userPrompt = prompt.trim();

    if (!userPrompt || isCreatingProject) {
      return;
    }

    setMessages((current) => [
      ...current,
      {
        id: Date.now(),
        role: "user",
        content: userPrompt,
      },
    ]);
    setPrompt("");
    setError(null);
    setIsCreatingProject(true);

    try {
      const nextProject = await createProject(userPrompt);
      const snapshot = await loadWorkspaceSnapshot(nextProject.id);

      setContent("");
      setProject(nextProject);
      setEntries(snapshot.entries);
      setSelectedPath(snapshot.selectedPath);
      setShowCodeWorkspace(snapshot.showCodeWorkspace);

      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: "Project created. Ready to build.",
        },
      ]);
    } catch (reason: unknown) {
      const message =
        reason instanceof Error ? reason.message : "Failed to create project";

      setError(message);
      setMessages((current) => [
        ...current,
        {
          id: Date.now() + 1,
          role: "assistant",
          content: `Failed to create project: ${message}`,
        },
      ]);
    } finally {
      setIsCreatingProject(false);
      setIsLoadingWorkspace(false);
    }
  }

  const selectedFileName = selectedPath?.split("/").at(-1) ?? "No file";

  return (
    <main className="grid h-screen w-screen grid-rows-[52px_minmax(0,1fr)] overflow-hidden bg-white text-[#16181d] max-[720px]:h-auto max-[720px]:min-h-screen max-[720px]:overflow-visible">
      <header className="grid grid-cols-[280px_1fr_auto] items-center gap-4 border-b border-[#e7e9ee] bg-white px-3.5 max-[720px]:grid-cols-[1fr_auto]">
        <div className="flex items-center gap-[9px] text-sm font-[650]">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-[#17191f] text-[13px] text-white">
            Y
          </span>
          <span>Yakable</span>
        </div>

        <div className="overflow-hidden text-center text-[13px] text-[#6d7280] text-ellipsis whitespace-nowrap max-[720px]:hidden">
          {project?.name ?? "Loading project..."}
        </div>

        <button
          className="cursor-pointer rounded-lg bg-[#17191f] px-3.5 py-[7px] text-[13px] text-white"
          type="button"
        >
          Run
        </button>
      </header>

      <section className="grid min-h-0 grid-cols-[minmax(320px,38%)_minmax(0,1fr)] max-[900px]:grid-cols-[minmax(280px,42%)_minmax(0,1fr)] max-[720px]:grid-cols-1">
        <aside className="grid min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] border-r border-[#e7e9ee] bg-white max-[720px]:min-h-[520px] max-[720px]:border-r-0 max-[720px]:border-b">
          <div className="flex min-h-[60px] items-center border-b border-[#eff0f3] px-[18px]">
            <div className="flex flex-col gap-0.5">
              <strong className="text-sm">Chat</strong>
              <span className="text-xs text-[#9297a3]">Build with Yakable</span>
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-3.5 overflow-auto px-[18px] py-5">
            {messages.map((message) => (
              <div
                className={
                  message.role === "user"
                    ? "max-w-[84%] self-end whitespace-pre-wrap rounded-xl bg-[#f0f1f4] px-3 py-2.5 text-[13px] leading-[1.6]"
                    : "max-w-[84%] self-start whitespace-pre-wrap rounded-xl border border-[#e8eaf0] bg-white px-3 py-2.5 text-[13px] leading-[1.6]"
                }
                key={message.id}
              >
                {message.content}
              </div>
            ))}
          </div>

          <div className="mx-3.5 mb-3.5 rounded-xl border border-[#dfe2e8] bg-white p-2.5">
            <textarea
              aria-label="Message"
              className="w-full resize-none border-0 bg-transparent text-[13px] leading-6 text-[#20232a] outline-none placeholder:text-[#a0a5af]"
              disabled={isCreatingProject}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void handleSubmit();
                }
              }}
              placeholder="Ask Yakable to build something..."
              rows={3}
              value={prompt}
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-[#9ba0aa]">
                Enter to send · Shift + Enter for new line
              </span>
              <button
                className="cursor-pointer rounded-lg bg-[#17191f] px-[11px] py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:opacity-40"
                disabled={!prompt.trim() || isCreatingProject}
                onClick={() => void handleSubmit()}
                type="button"
              >
                {isCreatingProject ? "Creating..." : "Send"}
              </button>
            </div>
          </div>
        </aside>

        {showCodeWorkspace ? (
          <section className="grid min-h-0 min-w-0 grid-cols-[210px_minmax(0,1fr)] bg-[#fbfbfc] max-[900px]:grid-cols-[160px_minmax(0,1fr)] max-[720px]:min-h-[520px]">
            <aside className="min-w-0 overflow-auto border-r border-[#e7e9ee] bg-[#f8f9fb]">
              <div className="flex h-[42px] items-center border-b border-[#e7e9ee] px-3.5 text-[11px] font-bold tracking-[0.08em] text-[#777c87] uppercase">
                Files
              </div>

              <div className="px-1.5 py-2">
                {entries.map((entry) => {
                  const indent =
                    indentClasses[Math.min(entry.depth, indentClasses.length - 1)];

                  if (entry.type === "folder") {
                    return (
                      <div
                        className={`flex w-full items-center gap-[7px] py-1.5 pr-2 text-xs text-[#555b66] ${indent}`}
                        key={entry.path}
                      >
                        <span className="w-3 text-center text-[#969ba5]">▾</span>
                        <span>{entry.name}</span>
                      </div>
                    );
                  }

                  const isActive = entry.path === selectedPath;

                  return (
                    <button
                      className={[
                        "flex w-full cursor-pointer items-center gap-[7px] rounded-md border-0 py-1.5 pr-2 text-left text-xs",
                        indent,
                        isActive
                          ? "bg-[#eceef2] text-[#1e2229]"
                          : "bg-transparent text-[#555b66] hover:bg-[#eceef2] hover:text-[#1e2229]",
                      ].join(" ")}
                      key={entry.path}
                      onClick={() => setSelectedPath(entry.path)}
                      type="button"
                    >
                      <span className="w-3 text-center text-[#969ba5]">·</span>
                      <span>{entry.name}</span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <section className="grid min-h-0 min-w-0 grid-rows-[42px_minmax(0,1fr)] bg-white">
              <div className="flex items-end border-b border-[#e7e9ee] bg-[#fafbfc]">
                <div className="flex h-[42px] items-center border-r border-[#e7e9ee] bg-white px-3.5 text-xs text-[#22262d]">
                  {selectedFileName}
                </div>
              </div>

              <div className="grid min-h-0 min-w-0 grid-cols-[48px_minmax(0,1fr)] overflow-auto bg-white py-3.5">
                {error ? (
                  <div className="col-span-2 px-4 text-sm text-red-600">
                    {error}
                  </div>
                ) : (
                  <>
                    <div className="flex select-none flex-col items-end pr-3 font-mono text-xs leading-[1.7] text-[#b0b4bc]">
                      {content.split("\n").map((_, index) => (
                        <span key={index}>{index + 1}</span>
                      ))}
                    </div>

                    <pre className="m-0 min-w-max pr-6 font-mono text-xs leading-[1.7] whitespace-pre text-[#272b33]">
                      <code>{content}</code>
                    </pre>
                  </>
                )}
              </div>
            </section>
          </section>
        ) : (
          <section className="grid min-h-0 min-w-0 place-items-center bg-[#fbfbfc] px-8 text-center max-[720px]:min-h-[520px]">
            {error ? (
              <div className="max-w-md text-sm leading-6 text-red-600">
                {error}
              </div>
            ) : (
              <div className="flex max-w-md flex-col items-center">
                <div className="mb-4 grid h-11 w-11 place-items-center rounded-xl border border-[#e2e4e9] bg-white text-sm font-semibold text-[#4e5562]">
                  Y
                </div>
                <div className="text-[15px] font-semibold text-[#20232a]">
                  {isLoadingWorkspace ? "Preparing workspace..." : "Ready to build"}
                </div>
                <div className="mt-2 text-[13px] leading-6 text-[#8a909b]">
                  {isLoadingWorkspace
                    ? "Setting up the project workspace."
                    : "Describe what you want to build. Files will appear after the first code change."}
                </div>
              </div>
            )}
          </section>
        )}
      </section>
    </main>
  );
}

async function loadWorkspaceSnapshot(
  projectId: string,
): Promise<WorkspaceSnapshot> {
  const entries = await listWorkspaceFiles(projectId);

  return {
    entries,
    selectedPath: findInitialFile(entries),
    showCodeWorkspace: true,
  };
}

function findInitialFile(entries: WorkspaceEntry[]): string | null {
  return (
    entries.find((entry) => entry.path === "src/App.tsx")?.path ??
    entries.find((entry) => entry.type === "file")?.path ??
    null
  );
}

export default App;
