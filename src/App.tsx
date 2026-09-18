const files = [
  { name: "src", type: "folder", level: 0 },
  { name: "App.tsx", type: "file", level: 1, active: true },
  { name: "main.tsx", type: "file", level: 1 },
  { name: "index.css", type: "file", level: 1 },
  { name: "index.html", type: "file", level: 0 },
  { name: "package.json", type: "file", level: 0 },
];

const code = `function App() {
  return (
    <main>
      <h1>Yakable</h1>
    </main>
  );
}

export default App;`;

function App() {
  return (
    <main className="workspace">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">Y</span>
          <span>Yakable</span>
        </div>
        <div className="project-name">Untitled project</div>
        <button className="topbar-button" type="button">
          Run
        </button>
      </header>

      <section className="workspace-body">
        <aside className="chat-panel">
          <div className="panel-header">
            <div>
              <strong>Chat</strong>
              <span>Build with Yakable</span>
            </div>
          </div>

          <div className="chat-content">
            <div className="assistant-message">
              Tell me what you want to build.
            </div>

            <div className="user-message">
              帮我做一个数据同步任务列表页面
            </div>

            <div className="assistant-message">
              I’ll update the project based on your request.
            </div>
          </div>

          <div className="chat-composer">
            <textarea
              aria-label="Message"
              placeholder="Ask Yakable to build something..."
              rows={3}
            />
            <div className="composer-actions">
              <span>Enter to send</span>
              <button type="button">Send</button>
            </div>
          </div>
        </aside>

        <section className="files-panel">
          <aside className="file-tree">
            <div className="file-tree-header">Files</div>

            <div className="file-list">
              {files.map((file) => (
                <button
                  className={`file-item ${file.active ? "active" : ""}`}
                  key={`${file.level}-${file.name}`}
                  style={{ paddingLeft: 14 + file.level * 16 }}
                  type="button"
                >
                  <span className="file-icon">
                    {file.type === "folder" ? "▾" : "·"}
                  </span>
                  <span>{file.name}</span>
                </button>
              ))}
            </div>
          </aside>

          <section className="editor">
            <div className="editor-tabs">
              <div className="editor-tab active">App.tsx</div>
            </div>

            <div className="editor-body">
              <div className="line-numbers">
                {code.split("\n").map((_, index) => (
                  <span key={index}>{index + 1}</span>
                ))}
              </div>
              <pre>
                <code>{code}</code>
              </pre>
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

export default App;
