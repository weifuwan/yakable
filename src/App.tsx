import { useState } from "react";

type ProjectFile = {
  name: string;
  path: string;
  content: string;
};

const projectFiles: ProjectFile[] = [
  {
    name: "App.tsx",
    path: "src/App.tsx",
    content: `function App() {
  return (
    <main>
      <h1>Yakable</h1>
    </main>
  );
}

export default App;`,
  },
  {
    name: "main.tsx",
    path: "src/main.tsx",
    content: `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);`,
  },
  {
    name: "index.css",
    path: "src/index.css",
    content: `@import "tailwindcss";`,
  },
  {
    name: "index.html",
    path: "index.html",
    content: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Yakable" />
    <title>Yakable</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
  },
  {
    name: "package.json",
    path: "package.json",
    content: `{
  "name": "yakable",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.3.0",
    "react-dom": "^19.3.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.1.0",
    "@types/react": "^19.3.0",
    "@types/react-dom": "^19.3.0",
    "@vitejs/plugin-react": "^6.1.1",
    "tailwindcss": "^4.1.0",
    "typescript": "^7.0.2",
    "vite": "^8.3.0"
  }
}`,
  },
];

const fileTree = [
  { name: "src", type: "folder", level: 0 },
  { name: "App.tsx", path: "src/App.tsx", type: "file", level: 1 },
  { name: "main.tsx", path: "src/main.tsx", type: "file", level: 1 },
  { name: "index.css", path: "src/index.css", type: "file", level: 1 },
  { name: "index.html", path: "index.html", type: "file", level: 0 },
  { name: "package.json", path: "package.json", type: "file", level: 0 },
] as const;

function App() {
  const [selectedPath, setSelectedPath] = useState("src/App.tsx");

  const selectedFile =
    projectFiles.find((file) => file.path === selectedPath) ?? projectFiles[0];

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
          Untitled project
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
            <div className="max-w-[84%] self-start rounded-xl border border-[#e8eaf0] bg-white px-3 py-2.5 text-[13px] leading-[1.6]">
              Tell me what you want to build.
            </div>

            <div className="max-w-[84%] self-end rounded-xl bg-[#f0f1f4] px-3 py-2.5 text-[13px] leading-[1.6]">
              帮我做一个数据同步任务列表页面
            </div>

            <div className="max-w-[84%] self-start rounded-xl border border-[#e8eaf0] bg-white px-3 py-2.5 text-[13px] leading-[1.6]">
              I’ll update the project based on your request.
            </div>
          </div>

          <div className="mx-3.5 mb-3.5 rounded-xl border border-[#dfe2e8] bg-white p-2.5">
            <textarea
              aria-label="Message"
              className="w-full resize-none border-0 bg-transparent text-[13px] leading-6 text-[#20232a] outline-none placeholder:text-[#a0a5af]"
              placeholder="Ask Yakable to build something..."
              rows={3}
            />

            <div className="flex items-center justify-between pt-2">
              <span className="text-[11px] text-[#9ba0aa]">Enter to send</span>
              <button
                className="cursor-pointer rounded-lg bg-[#17191f] px-[11px] py-1.5 text-xs text-white"
                type="button"
              >
                Send
              </button>
            </div>
          </div>
        </aside>

        <section className="grid min-h-0 min-w-0 grid-cols-[210px_minmax(0,1fr)] bg-[#fbfbfc] max-[900px]:grid-cols-[160px_minmax(0,1fr)] max-[720px]:min-h-[520px]">
          <aside className="min-w-0 border-r border-[#e7e9ee] bg-[#f8f9fb]">
            <div className="flex h-[42px] items-center border-b border-[#e7e9ee] px-3.5 text-[11px] font-bold tracking-[0.08em] text-[#777c87] uppercase">
              Files
            </div>

            <div className="px-1.5 py-2">
              {fileTree.map((file) => {
                if (file.type === "folder") {
                  return (
                    <div
                      className="flex w-full items-center gap-[7px] py-1.5 pr-2 pl-3.5 text-xs text-[#555b66]"
                      key={`${file.level}-${file.name}`}
                    >
                      <span className="w-3 text-center text-[#969ba5]">▾</span>
                      <span>{file.name}</span>
                    </div>
                  );
                }

                const isActive = file.path === selectedPath;

                return (
                  <button
                    className={[
                      "flex w-full cursor-pointer items-center gap-[7px] rounded-md border-0 py-1.5 pr-2 text-left text-xs",
                      file.level === 1 ? "pl-[30px]" : "pl-3.5",
                      isActive
                        ? "bg-[#eceef2] text-[#1e2229]"
                        : "bg-transparent text-[#555b66] hover:bg-[#eceef2] hover:text-[#1e2229]",
                    ].join(" ")}
                    key={file.path}
                    onClick={() => setSelectedPath(file.path)}
                    type="button"
                  >
                    <span className="w-3 text-center text-[#969ba5]">·</span>
                    <span>{file.name}</span>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="grid min-h-0 min-w-0 grid-rows-[42px_minmax(0,1fr)] bg-white">
            <div className="flex items-end border-b border-[#e7e9ee] bg-[#fafbfc]">
              <div className="flex h-[42px] items-center border-r border-[#e7e9ee] bg-white px-3.5 text-xs text-[#22262d]">
                {selectedFile.name}
              </div>
            </div>

            <div className="grid min-h-0 min-w-0 grid-cols-[48px_minmax(0,1fr)] overflow-auto bg-white py-3.5">
              <div className="flex select-none flex-col items-end pr-3 font-mono text-xs leading-[1.7] text-[#b0b4bc]">
                {selectedFile.content.split("\n").map((_, index) => (
                  <span key={index}>{index + 1}</span>
                ))}
              </div>

              <pre className="m-0 min-w-max pr-6 font-mono text-xs leading-[1.7] whitespace-pre text-[#272b33]">
                <code>{selectedFile.content}</code>
              </pre>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

export default App;
