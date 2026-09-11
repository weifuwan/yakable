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
  | 'external'
  | 'share'
  | 'file'
  | 'users'
  | 'template'
  | 'palette'
  | 'gift'
  | 'chevronDown'
  | 'panel'
  | 'sliders'
  | 'list'
  | 'image'
  | 'github'
  | 'figma'
  | 'book'
  | 'support'
  | 'command';

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

type ViewMode = 'grid' | 'list';
type ProjectFilter = 'all' | 'day' | 'week';
type ProjectSort = 'updated' | 'name';

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
    sparkle: <><path d="m12 3 1.1 3.1L16 7.2l-2.9 1.1L12 11.5l-1.1-3.2L8 7.2l2.9-1.1L12 3Z"/><path d="m18 13 .8 2.1L21 16l-2.2.9L18 19l-.8-2.1L15 16l2.2-.9L18 13Z"/></>,
    folder: <path d="M3.5 7.5h6l1.6 2h9.4v9.5h-17z"/>,
    back: <><path d="m14.5 6-6 6 6 6"/><path d="M9 12h10"/></>,
    refresh: <><path d="M19 8a7 7 0 1 0 .4 7"/><path d="M19 4v4h-4"/></>,
    external: <><path d="M14 5h5v5"/><path d="m13 11 6-6"/><path d="M19 13v6H5V5h6"/></>,
    share: <><circle cx="18" cy="5" r="2.2"/><circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="19" r="2.2"/><path d="m8 11 8-5M8 13l8 5"/></>,
    file: <><path d="M6 3.5h8l4 4V20H6z"/><path d="M14 3.5V8h4"/></>,
    users: <><circle cx="9" cy="8" r="3"/><path d="M3.5 19c.6-3.4 2.4-5.2 5.5-5.2s4.9 1.8 5.5 5.2"/><path d="M15.5 5.5a2.7 2.7 0 0 1 0 5.2M16.2 14c2.4.3 3.7 1.9 4.2 4.4"/></>,
    template: <><rect x="3.5" y="4" width="17" height="6" rx="1.5"/><rect x="3.5" y="14" width="8" height="6" rx="1.5"/><rect x="15.5" y="14" width="5" height="6" rx="1.5"/></>,
    palette: <><circle cx="7" cy="7" r="2.2"/><circle cx="17" cy="7" r="2.2"/><circle cx="7" cy="17" r="2.2"/><circle cx="17" cy="17" r="2.2"/></>,
    gift: <><path d="M4 10h16v10H4zM3 7h18v3H3zM12 7v13"/><path d="M12 7c-2.3 0-4.5-.8-4.5-2.3 0-1.1.8-1.7 1.8-1.7 1.5 0 2.7 1.6 2.7 4ZM12 7c2.3 0 4.5-.8 4.5-2.3 0-1.1-.8-1.7-1.8-1.7C13.2 3 12 4.6 12 7Z"/></>,
    chevronDown: <path d="m7 9 5 5 5-5"/>,
    panel: <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/></>,
    sliders: <><path d="M4 7h10M18 7h2M4 17h3M11 17h9"/><circle cx="16" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></>,
    list: <><path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r=".7" fill="currentColor" stroke="none"/><circle cx="4" cy="12" r=".7" fill="currentColor" stroke="none"/><circle cx="4" cy="18" r=".7" fill="currentColor" stroke="none"/></>,
    image: <><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m5 18 5-5 3 3 2-2 4 4"/></>,
    github: <><circle cx="12" cy="12" r="8.5"/><path d="M9 18c-2 .5-2-1-3-1.5M15 18v-2.2c0-.8-.3-1.4-.8-1.8 2.6-.3 4.8-1.3 4.8-5a3.8 3.8 0 0 0-1-2.6c.1-.7.1-1.7-.4-2.6 0 0-.8-.2-2.7 1a9.5 9.5 0 0 0-5.8 0c-1.9-1.2-2.7-1-2.7-1-.5.9-.5 1.9-.4 2.6A3.8 3.8 0 0 0 6 9c0 3.7 2.2 4.7 4.8 5-.4.3-.7.8-.8 1.4V18"/></>,
    figma: <><rect x="8" y="3" width="4" height="6" rx="2"/><rect x="12" y="3" width="4" height="6" rx="2"/><rect x="8" y="9" width="4" height="6" rx="2"/><circle cx="14" cy="12" r="2"/><rect x="8" y="15" width="4" height="6" rx="2"/></>,
    book: <><path d="M4 4h6.5A3.5 3.5 0 0 1 14 7.5V20a3.5 3.5 0 0 0-3.5-3.5H4z"/><path d="M20 4h-6.5A3.5 3.5 0 0 0 10 7.5V20a3.5 3.5 0 0 1 3.5-3.5H20z"/></>,
    support: <><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 0 1 4.6.9c0 1.8-2.3 2.2-2.3 3.8M12 17h.01"/></>,
    command: <path d="M15.5 4.5 8.5 19.5"/>,
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

function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <a className="brand" href="/" aria-label="Yakable home">
          <span className="brand-mark"><span>Y</span></span>
          <strong>Yakable</strong>
        </a>
        <span className="topbar-divider">/</span>
        <button className="workspace-menu" type="button">
          <span className="workspace-badge-mark">Y</span>
          <span>My Workspace</span>
          <span className="plan-badge">Free</span>
          <Icon name="chevronDown" size={14}/>
        </button>
      </div>
      <div className="topbar-actions">
        <span className="stage-badge"><i/>Stage 3 ready</span>
        <a className="top-action" href="https://github.com/weifuwan/yakable" target="_blank" rel="noreferrer">
          <Icon name="github" size={15}/> GitHub
        </a>
        <button className="profile-avatar" type="button" aria-label="Account">W</button>
      </div>
    </header>
  );
}

function SidebarItem({ icon, label, active, shortcut }: { icon: IconName; label: string; active?: boolean; shortcut?: string }) {
  return (
    <button className={`sidebar-item ${active ? 'active' : ''}`} type="button">
      <span className="sidebar-icon"><Icon name={icon} size={16}/></span>
      <span className="sidebar-label">{label}</span>
      {shortcut ? <kbd>{shortcut}</kbd> : null}
    </button>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <button className="create-button" type="button">
        <Icon name="plus" size={16}/><span>Create</span><Icon name="chevronDown" size={14}/>
      </button>
      <nav className="sidebar-nav" aria-label="Main navigation">
        <SidebarItem icon="search" label="Search" shortcut="Ctrl K"/>
        <SidebarItem icon="home" label="Home" active/>
        <SidebarItem icon="share" label="Shared with me"/>
      </nav>
      <div className="sidebar-divider-line"/>
      <div className="sidebar-workspace-title">
        <span className="workspace-badge-mark">Y</span>
        <strong>My Workspace</strong>
        <span className="plan-badge">Free</span>
        <Icon name="chevronDown" size={14}/>
      </div>
      <nav className="sidebar-nav workspace-nav" aria-label="Workspace navigation">
        <SidebarItem icon="file" label="Files"/>
        <SidebarItem icon="users" label="Shared with workspace"/>
        <SidebarItem icon="template" label="Templates"/>
        <SidebarItem icon="palette" label="Design Systems"/>
      </nav>
      <div className="sidebar-spacer"/>
      <div className="flow-card">
        <div><strong>Generation flow</strong><small>Prompt → Code → Run</small></div>
        <span><i/>Ready</span>
      </div>
      <div className="sidebar-divider-line bottom"/>
      <nav className="sidebar-nav sidebar-footer-nav" aria-label="Help navigation">
        <SidebarItem icon="book" label="Documentation"/>
        <SidebarItem icon="support" label="Get support"/>
      </nav>
    </aside>
  );
}

function Composer({ onCreate, busy }: { onCreate: (prompt: string) => Promise<void>; busy: boolean }) {
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState('');
  const quickActions: Array<{ label: string; icon: IconName; prompt: string }> = [
    { label: 'Recreate a screenshot', icon: 'image', prompt: 'Recreate a polished web page from a screenshot with a clean responsive layout.' },
    { label: 'Import from GitHub', icon: 'github', prompt: 'Create a polished frontend for an existing GitHub project and keep the implementation simple.' },
    { label: 'Import from Figma', icon: 'figma', prompt: 'Turn a Figma-style product design into a responsive React interface.' },
    { label: 'Create a landing page', icon: 'template', prompt: 'Build a clean SaaS landing page with a hero, feature section, and pricing cards.' },
  ];

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
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask Yakable to build anything..."
          aria-label="Describe what you want to build"
          rows={2}
          disabled={busy}
        />
        <div className="composer-row">
          <div className="composer-left-actions">
            <button className="composer-icon-button" type="button" aria-label="Add attachment" disabled={busy}><Icon name="plus" size={18}/></button>
            <button className="composer-icon-button command-button" type="button" aria-label="Commands" disabled={busy}><Icon name="command" size={18}/></button>
            <button className="design-system-pill" type="button" disabled={busy}>
              <span>Design System</span><b><span className="mini-brand-mark">Y</span> Base <Icon name="chevronDown" size={12}/></b>
            </button>
          </div>
          <div className="composer-actions">
            <button className="auto-button" type="button" disabled={busy}>Auto <Icon name="chevronDown" size={13}/></button>
            <button className="composer-icon-button" type="button" aria-label="Voice input" disabled={busy}><Icon name="mic" size={16}/></button>
            <button className="send-button" type="submit" disabled={!prompt.trim() || busy} aria-label="Send"><Icon name="send" size={17}/></button>
          </div>
        </div>
      </form>
      <div className="quick-actions" aria-label="Prompt shortcuts">
        {quickActions.map((action) => (
          <button key={action.label} type="button" onClick={() => setPrompt(action.prompt)} disabled={busy}>
            <Icon name={action.icon} size={14}/>{action.label}
          </button>
        ))}
      </div>
      {busy ? <div className="composer-status show"><span className="status-spinner"/>DeepSeek is generating code and starting the runtime…</div> : null}
      {error ? <div className="composer-status error show">{error}</div> : null}
    </div>
  );
}

function ProjectPreview({ variant }: { variant: string }) {
  return (
    <div className={`project-preview preview-${variant}`}>
      <div className="preview-window">
        <div className="preview-topbar"><span/><span/><span/></div>
        <div className="preview-content">
          <div className="preview-nav"><b>Y</b><span/><span/><span/></div>
          <div className="preview-hero-line wide"/><div className="preview-hero-line"/>
          <div className="preview-button"/>
          <div className="preview-grid"><i/><i/><i/></div>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project, index, onOpen, viewMode }: { project: ProjectListItem; index: number; onOpen: (id: string) => void; viewMode: ViewMode }) {
  const variants = ['blue', 'violet', 'mint'];
  return (
    <article className={`project-card ${viewMode === 'list' ? 'list-card' : ''}`}>
      <button className="project-thumb" type="button" onClick={() => onOpen(project.id)} aria-label={`Open ${projectTitle(project.id)}`}>
        <ProjectPreview variant={variants[index % variants.length] ?? 'blue'}/>
        <span className="favorite-button"><Icon name="star" size={15}/></span>
      </button>
      <button className="project-footer" type="button" onClick={() => onOpen(project.id)}>
        <span className="project-avatar"><Icon name="grid" size={12}/></span>
        <span className="project-copy"><strong>{projectTitle(project.id)}</strong><small>Edited {editedLabel(project.updatedAt)}</small></span>
        <span className="project-more">•••</span>
      </button>
    </article>
  );
}

function ProjectGallery({ projects, loading, onOpen }: { projects: ProjectListItem[]; loading: boolean; onOpen: (id: string) => void }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProjectFilter>('all');
  const [sort, setSort] = useState<ProjectSort>('updated');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  const visibleProjects = useMemo(() => {
    const now = Date.now();
    const maxAge = filter === 'day' ? 86_400_000 : filter === 'week' ? 604_800_000 : Number.POSITIVE_INFINITY;
    const filtered = projects.filter((project) => {
      const matchesSearch = projectTitle(project.id).toLowerCase().includes(query.trim().toLowerCase());
      const age = now - new Date(project.updatedAt).getTime();
      return matchesSearch && age <= maxAge;
    });
    return [...filtered].sort((a, b) => sort === 'name'
      ? projectTitle(a.id).localeCompare(projectTitle(b.id))
      : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [projects, query, filter, sort]);

  return (
    <section className="recents-section">
      <div className="recents-heading-row">
        <h2>Recents</h2>
        <div className="recents-controls">
          <button className={`square-control ${searchOpen ? 'active' : ''}`} type="button" aria-label="Search projects" onClick={() => setSearchOpen((value) => !value)}><Icon name="search" size={14}/></button>
          <div className="filter-wrap">
            <button className={`control-button ${filter !== 'all' ? 'active' : ''}`} type="button" onClick={() => setFilterOpen((value) => !value)}><Icon name="sliders" size={14}/>Filter</button>
            {filterOpen ? (
              <div className="filter-menu">
                {([['all', 'All projects'], ['day', 'Last 24 hours'], ['week', 'Last 7 days']] as Array<[ProjectFilter, string]>).map(([value, label]) => (
                  <button key={value} type="button" className={filter === value ? 'active' : ''} onClick={() => { setFilter(value); setFilterOpen(false); }}>{label}</button>
                ))}
              </div>
            ) : null}
          </div>
          <label className="sort-control">
            <select value={sort} onChange={(event) => setSort(event.target.value as ProjectSort)} aria-label="Sort projects">
              <option value="updated">Last Updated</option>
              <option value="name">Name</option>
            </select>
            <Icon name="chevronDown" size={13}/>
          </label>
          <div className="view-toggle" role="group" aria-label="Project view">
            <button className={viewMode === 'grid' ? 'active' : ''} type="button" onClick={() => setViewMode('grid')} aria-label="Grid view"><Icon name="grid" size={14}/></button>
            <button className={viewMode === 'list' ? 'active' : ''} type="button" onClick={() => setViewMode('list')} aria-label="List view"><Icon name="list" size={14}/></button>
          </div>
        </div>
      </div>
      {searchOpen ? <div className="gallery-search"><Icon name="search" size={16}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects"/></div> : null}
      {loading ? <div className="empty-projects">Loading generated projects…</div> : null}
      {!loading && visibleProjects.length === 0 ? <div className="empty-projects"><strong>No projects here yet.</strong><span>Describe an idea above and Yakable will create the first one.</span></div> : null}
      <div className={`project-grid ${viewMode}`}>{visibleProjects.map((project, index) => <ProjectCard key={project.id} project={project} index={index} onOpen={onOpen} viewMode={viewMode}/>)}</div>
    </section>
  );
}

function Dashboard({ projects, loading, onCreate, onOpen }: { projects: ProjectListItem[]; loading: boolean; onCreate: (prompt: string) => Promise<void>; onOpen: (id: string) => Promise<void> }) {
  const [creating, setCreating] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  async function create(prompt: string) {
    setCreating(true);
    try { await onCreate(prompt); } finally { setCreating(false); }
  }

  return (
    <div className="dashboard-shell">
      <Topbar/>
      <div className={`dashboard-body ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        <Sidebar/>
        <main className="dashboard-surface">
          <button className="surface-sidebar-toggle" type="button" onClick={() => setSidebarCollapsed((value) => !value)} aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}><Icon name="panel" size={16}/></button>
          <section className="hero-section">
            <div className="hero-aura" aria-hidden="true"/>
            <div className="hero-content">
              <h1>Let&apos;s build something.</h1>
              <Composer onCreate={create} busy={creating}/>
            </div>
          </section>
          <ProjectGallery projects={projects} loading={loading} onOpen={(id) => void onOpen(id)}/>
        </main>
      </div>
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
          <iframe key={previewUrl} title={`${project.title} preview`} src={previewUrl} sandbox="allow-scripts allow-same-origin allow-forms allow-popups" referrerPolicy="no-referrer"/>
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
    return <Workspace project={activeProject} onBack={() => { setActiveProject(null); void reloadProjects(); }}/>
  }

  return <Dashboard projects={projects} loading={loading} onCreate={handleCreate} onOpen={handleOpen}/>;
}
