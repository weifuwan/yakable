import { FormEvent, useEffect, useMemo, useState } from 'react';

import {
  createProject,
  editProject,
  listProjects,
  startProjectRuntime,
  type ProjectListItem,
} from './api';

type IconName =
  | 'home'
  | 'search'
  | 'grid'
  | 'star'
  | 'user'
  | 'clock'
  | 'plus'
  | 'mic'
  | 'send'
  | 'sparkle'
  | 'folder'
  | 'back'
  | 'refresh'
  | 'external';

type ActiveProject = {
  id: string;
  title: string;
  previewUrl: string;
  summary?: string;
  model?: string;
};

type ChatMessage = {
  role: 'user' | 'assistant' | 'error';
  content: string;
};

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
  const paths: Record<IconName, React.ReactNode> = {
    home: <><path d="M3.5 10.8 12 4l8.5 6.8"/><path d="M5.5 9.8V20h13V9.8"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.2"/><path d="m15.4 15.4 4.1 4.1"/></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>,
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M5.3 20c.8-4 3.1-6 6.7-6s5.9 2 6.7 6"/></>,
    clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    mic: <><rect x="9" y="4" width="6" height="10" rx="3"/><path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3"/></>,
    send: <><path d="M12 19V6"/><path d="m7.5 10.5 4.5-4.5 4.5 4.5"/></>,
    sparkle: <><path d="m12 3 1.1 3.1L16 7.2l-2.9 1.1L12 11.5l-1.1-3.2L8 7.2l2.9-1.1L12 3Z"/></>,
    folder: <path d="M3.5 7.5h6l1.6 2h9.4v9.5h-17z"/>,
    back: <><path d="m14.5 6-6 6 6 6"/><path d="M9 12h10"/></>,
    refresh: <><path d="M19 8a7 7 0 1 0 .4 7"/><path d="M19 4v4h-4"/></>,
    external: <><path d="M14 5h5v5"/><path d="m13 11 6-6"/><path d="M19 13v6H5V5h6"/></>,
  };
  return <svg {...common}>{paths[name]}</svg>;
}

function projectTitle(id: string): string {
  const base = id.replace(/-\d{4}-\d{2}-\d{2}T.*$/, '');
  return (base || id)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function editedLabel(updatedAt: string): string {
  const delta = Date.now() - new Date(updatedAt).getTime();
  const minutes = Math.max(0, Math.floor(delta / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function SidebarItem({ icon, label, active, shortcut }: { icon: IconName; label: string; active?: boolean; shortcut?: string }) {
  return (
    <button className={`sidebar-item ${active ? 'active' : ''}`} type="button">
      <span className="sidebar-icon"><Icon name={icon} size={17} /></span>
      <span className="sidebar-label">{label}</span>
      {shortcut ? <kbd>{shortcut}</kbd> : null}
    </button>
  );
}

function Sidebar({ projects, onOpen }: { projects: ProjectListItem[]; onOpen: (id: string) => void }) {
  const firstProject = projects[0];
  return (
    <aside className="sidebar">
      <div className="workspace-switcher">
        <span className="workspace-mark">Y</span>
        <span className="workspace-name">Yakable Workspace</span>
        <span className="workspace-caret">⌄</span>
      </div>
      <nav className="sidebar-nav" aria-label="Main navigation">
        <SidebarItem icon="home" label="Dashboard" active />
        <SidebarItem icon="search" label="Search" shortcut="Ctrl K" />
        <SidebarItem icon="grid" label="Projects" />
      </nav>
      <div className="sidebar-section">
        <div className="sidebar-heading">Projects</div>
        <SidebarItem icon="grid" label="All projects" />
        <div className="folder-row"><span className="folder-line"/><span>No folders</span><Icon name="folder" size={14}/></div>
        <SidebarItem icon="star" label="Starred" />
        <SidebarItem icon="user" label="Owned by me" />
        {firstProject ? <button type="button" className="nested-project" onClick={() => onOpen(firstProject.id)}>{projectTitle(firstProject.id)}</button> : null}
      </div>
      <div className="sidebar-section recent-section">
        <div className="sidebar-heading">Recents</div>
        {projects.slice(0, 3).map((project) => (
          <button key={project.id} type="button" className="recent-project" onClick={() => onOpen(project.id)}>
            <Icon name="clock" size={14}/>{projectTitle(project.id)}
          </button>
        ))}
      </div>
      <div className="sidebar-spacer" />
      <div className="upgrade-card">
        <span><strong>Real product flow</strong><small>Prompt → Code → Run → Patch</small></span>
        <span className="upgrade-badge"><Icon name="sparkle" size={17}/></span>
      </div>
      <button type="button" className="profile-button" aria-label="Profile"><span className="avatar">W</span></button>
    </aside>
  );
}

function Composer({ onCreate, busy }: { onCreate: (prompt: string) => Promise<void>; busy: boolean }) {
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const request = prompt.trim();
    if (!request || busy) return;
    setError('');
    try {
      await onCreate(request);
      setPrompt('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Project generation failed.');
    }
  }

  return (
    <div className="composer-wrap">
      <form className="composer" onSubmit={submit}>
        <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask Yakable to build..." aria-label="Describe what you want to build" rows={2} disabled={busy}/>
        <div className="composer-row">
          <button className="composer-icon-button" type="button" aria-label="Add attachment" disabled={busy}><Icon name="plus" /></button>
          <div className="composer-actions">
            <span className="mode-button">Build</span>
            <button className="composer-icon-button" type="button" aria-label="Voice input" disabled={busy}><Icon name="mic" /></button>
            <button className="send-button" type="submit" disabled={!prompt.trim() || busy} aria-label="Send"><Icon name="send" /></button>
          </div>
        </div>
      </form>
      {busy ? <div className="composer-status show"><span className="status-spinner"/>DeepSeek is generating code and starting the runtime…</div> : null}
      {error ? <div className="composer-status error show">{error}</div> : null}
    </div>
  );
}

function ProjectPreview({ variant }: { variant: string }) {
  return (
    <div className={`project-preview preview-${variant}`}>
      <div className="preview-window"><div className="preview-topbar"><span/><span/><span/></div><div className="preview-content"><div className="preview-nav"><b>Y</b><span/><span/><span/></div><div className="preview-hero-line wide"/><div className="preview-hero-line"/><div className="preview-button"/><div className="preview-grid"><i/><i/><i/></div></div></div>
    </div>
  );
}

function ProjectCard({ project, index, onOpen }: { project: ProjectListItem; index: number; onOpen: (id: string) => void }) {
  const variants = ['blue', 'violet', 'peach'];
  return (
    <article className="project-card">
      <button className="project-thumb" type="button" onClick={() => onOpen(project.id)} aria-label={`Open ${projectTitle(project.id)}`}>
        <ProjectPreview variant={variants[index % variants.length] ?? 'blue'} />
        <span className="favorite-button"><Icon name="star" size={16}/></span>
      </button>
      <div className="project-meta"><span className="project-avatar">Y</span><div className="project-copy"><strong>{projectTitle(project.id)}</strong><small>Edited {editedLabel(project.updatedAt)}</small></div><button className="project-more" type="button" aria-label="More options">•••</button></div>
    </article>
  );
}

function ProjectGallery({ projects, loading, onOpen }: { projects: ProjectListItem[]; loading: boolean; onOpen: (id: string) => void }) {
  const [activeTab, setActiveTab] = useState('My projects');
  const [query, setQuery] = useState('');
  const tabs = ['Search', 'My projects', 'Recently viewed', 'Yakable templates'];
  const visibleProjects = useMemo(() => {
    if (!query.trim()) return projects;
    return projects.filter((project) => projectTitle(project.id).toLowerCase().includes(query.toLowerCase()));
  }, [projects, query]);

  return (
    <section className="gallery-panel">
      <div className="gallery-toolbar"><div className="gallery-tabs">{tabs.map((tab) => <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={activeTab === tab ? 'active' : ''}>{tab === 'Search' ? <Icon name="search" size={15}/> : null}{tab}</button>)}</div><span className="browse-button">Local projects</span></div>
      {activeTab === 'Search' ? <div className="gallery-search"><Icon name="search" size={16}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects" /></div> : null}
      {loading ? <div className="empty-projects">Loading generated projects…</div> : null}
      {!loading && visibleProjects.length === 0 ? <div className="empty-projects"><strong>No generated projects yet.</strong><span>Describe an idea above to create your first one.</span></div> : null}
      <div className="project-grid">{visibleProjects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} onOpen={onOpen}/>)}</div>
    </section>
  );
}

function Dashboard({ projects, loading, onCreate, onOpen }: { projects: ProjectListItem[]; loading: boolean; onCreate: (prompt: string) => Promise<void>; onOpen: (id: string) => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  async function create(prompt: string) {
    setCreating(true);
    try { await onCreate(prompt); } finally { setCreating(false); }
  }
  return (
    <div className="dashboard-shell">
      <Sidebar projects={projects} onOpen={(id) => void onOpen(id)} />
      <div className="main-column"><main className="dashboard-surface"><section className="hero-section"><div className="hero-glow" aria-hidden="true"/><div className="hero-content"><div className="announcement-pill"><span className="pill-dots"><i/><i/><i/></span>Stage 1–3 connected <span>→</span></div><h1>Got an idea?</h1><p className="hero-subtitle">Describe it. Yakable will generate the code, start it, and open a live workspace.</p><Composer onCreate={create} busy={creating}/></div><div className="hero-spark spark-one"/><div className="hero-spark spark-two"/></section><ProjectGallery projects={projects} loading={loading} onOpen={(id) => void onOpen(id)}/></main></div>
    </div>
  );
}

function Workspace({ project, onBack }: { project: ActiveProject; onBack: () => void }) {
  const [previewUrl, setPreviewUrl] = useState(project.previewUrl);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', content: project.summary || 'Project is running. Tell Yakable what you want to change.' },
  ]);

  async function submitEdit(event: FormEvent) {
    event.preventDefault();
    const request = prompt.trim();
    if (!request || busy) return;
    setPrompt('');
    setMessages((current) => [...current, { role: 'user', content: request }]);
    setBusy(true);
    try {
      const result = await editProject(project.id, request);
      setPreviewUrl(result.previewUrl);
      setMessages((current) => [...current, {
        role: 'assistant',
        content: `${result.summary}\nChanged: ${result.changedFiles.join(', ')}`,
      }]);
    } catch (caught) {
      setMessages((current) => [...current, { role: 'error', content: caught instanceof Error ? caught.message : 'Edit failed.' }]);
    } finally {
      setBusy(false);
    }
  }

  function refreshPreview() {
    const url = new URL(previewUrl);
    url.searchParams.set('clientRefresh', String(Date.now()));
    setPreviewUrl(url.toString());
  }

  return (
    <div className="workspace-shell">
      <header className="workspace-header">
        <button type="button" className="workspace-back" onClick={onBack}><Icon name="back" size={17}/> Dashboard</button>
        <div className="workspace-title"><span className="workspace-mark">Y</span><strong>{project.title}</strong><span className="live-badge"><i/>Live</span></div>
        <div className="workspace-tools"><button type="button" onClick={refreshPreview}><Icon name="refresh" size={16}/>Refresh</button><a href={previewUrl} target="_blank" rel="noreferrer"><Icon name="external" size={16}/>Open</a></div>
      </header>
      <div className="workspace-body">
        <section className="chat-panel">
          <div className="chat-heading"><span>Build</span><small>{project.model || 'DeepSeek'}</small></div>
          <div className="chat-messages">
            {messages.map((message, index) => <div key={`${message.role}-${index}`} className={`chat-message ${message.role}`}>{message.content.split('\n').map((line) => <p key={line}>{line}</p>)}</div>)}
            {busy ? <div className="chat-message assistant"><p><span className="status-spinner"/> Updating the existing project…</p></div> : null}
          </div>
          <form className="workspace-composer" onSubmit={submitEdit}>
            <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask Yakable to change this project…" rows={3} disabled={busy}/>
            <div className="workspace-composer-row"><span>Prompt → Patch</span><button type="submit" disabled={!prompt.trim() || busy}><Icon name="send" size={17}/></button></div>
          </form>
        </section>
        <section className="preview-panel">
          <div className="preview-toolbar"><span className="preview-dot"/><span>{previewUrl.replace(/^https?:\/\//, '').split('?')[0]}</span></div>
          <iframe key={previewUrl} title={`${project.title} preview`} src={previewUrl} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerPolicy="no-referrer" />
        </section>
      </div>
    </div>
  );
}

export default function App() {
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProject, setActiveProject] = useState<ActiveProject | null>(null);

  async function reloadProjects() {
    setLoading(true);
    try { setProjects(await listProjects()); } finally { setLoading(false); }
  }

  useEffect(() => {
    void reloadProjects().catch((error) => {
      console.error(error);
      setLoading(false);
    });
  }, []);

  async function handleCreate(prompt: string) {
    const result = await createProject(prompt);
    setActiveProject({
      id: result.project.id,
      title: projectTitle(result.project.id),
      previewUrl: result.previewUrl,
      summary: result.project.summary,
      model: result.project.model,
    });
    void reloadProjects();
  }

  async function handleOpen(projectId: string) {
    const runtime = await startProjectRuntime(projectId);
    setActiveProject({ id: projectId, title: projectTitle(projectId), previewUrl: runtime.previewUrl });
  }

  if (activeProject) {
    return <Workspace project={activeProject} onBack={() => { setActiveProject(null); void reloadProjects(); }} />;
  }

  return <Dashboard projects={projects} loading={loading} onCreate={handleCreate} onOpen={handleOpen} />;
}
