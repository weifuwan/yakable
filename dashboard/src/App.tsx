import { FormEvent, useMemo, useState } from 'react';

type IconName =
  | 'home'
  | 'search'
  | 'grid'
  | 'star'
  | 'user'
  | 'clock'
  | 'plus'
  | 'chevron'
  | 'mic'
  | 'send'
  | 'sparkle'
  | 'folder';

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
    home: <><path d="M3.5 10.8 12 4l8.5 6.8"/><path d="M5.5 9.8V20h13V9.8"/><path d="M9.5 20v-5.5h5V20"/></>,
    search: <><circle cx="10.8" cy="10.8" r="6.2"/><path d="m15.4 15.4 4.1 4.1"/></>,
    grid: <><rect x="4" y="4" width="6" height="6" rx="1.5"/><rect x="14" y="4" width="6" height="6" rx="1.5"/><rect x="4" y="14" width="6" height="6" rx="1.5"/><rect x="14" y="14" width="6" height="6" rx="1.5"/></>,
    star: <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>,
    user: <><circle cx="12" cy="8" r="3.5"/><path d="M5.3 20c.8-4 3.1-6 6.7-6s5.9 2 6.7 6"/></>,
    clock: <><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3.2 2"/></>,
    plus: <><path d="M12 5v14"/><path d="M5 12h14"/></>,
    chevron: <path d="m9 7 5 5-5 5"/>,
    mic: <><rect x="9" y="4" width="6" height="10" rx="3"/><path d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3"/></>,
    send: <><path d="M12 19V6"/><path d="m7.5 10.5 4.5-4.5 4.5 4.5"/></>,
    sparkle: <><path d="m12 3 1.1 3.1L16 7.2l-2.9 1.1L12 11.5l-1.1-3.2L8 7.2l2.9-1.1L12 3Z"/><path d="m18 13 .7 1.8 1.8.7-1.8.7L18 18l-.7-1.8-1.8-.7 1.8-.7L18 13Z"/></>,
    folder: <path d="M3.5 7.5h6l1.6 2h9.4v9.5h-17z"/>,
  };

  return <svg {...common}>{paths[name]}</svg>;
}

const navItems = [
  { icon: 'home' as const, label: 'Dashboard', active: true },
  { icon: 'search' as const, label: 'Search', shortcut: 'Ctrl K' },
  { icon: 'grid' as const, label: 'Projects' },
];

const projects = [
  { title: 'SaaS Hero', edited: 'Just now', variant: 'blue' },
  { title: 'Analytics Landing', edited: '12 min ago', variant: 'violet' },
  { title: 'Team Workspace', edited: 'Yesterday', variant: 'peach' },
];

function SidebarItem({ icon, label, active, shortcut }: { icon: IconName; label: string; active?: boolean; shortcut?: string }) {
  return (
    <button className={`sidebar-item ${active ? 'active' : ''}`} type="button">
      <span className="sidebar-icon"><Icon name={icon} size={17} /></span>
      <span className="sidebar-label">{label}</span>
      {shortcut ? <kbd>{shortcut}</kbd> : null}
    </button>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="workspace-switcher">
        <span className="workspace-mark">Y</span>
        <span className="workspace-name">Yakable Workspace</span>
        <span className="workspace-caret">⌄</span>
      </div>

      <nav className="sidebar-nav" aria-label="Main navigation">
        {navItems.map((item) => <SidebarItem key={item.label} {...item} />)}
      </nav>

      <div className="sidebar-section">
        <div className="sidebar-heading">Projects</div>
        <SidebarItem icon="grid" label="All projects" />
        <div className="folder-row"><span className="folder-line"/><span>No folders</span><Icon name="folder" size={14}/></div>
        <SidebarItem icon="star" label="Starred" />
        <SidebarItem icon="user" label="Owned by me" />
        <button type="button" className="nested-project">SaaS Hero</button>
      </div>

      <div className="sidebar-section recent-section">
        <div className="sidebar-heading">Recents</div>
        <button type="button" className="recent-project"><Icon name="clock" size={14}/>SaaS Hero</button>
      </div>

      <div className="sidebar-spacer" />

      <button type="button" className="upgrade-card">
        <span><strong>Build faster</strong><small>Stage 1–3 are ready</small></span>
        <span className="upgrade-badge"><Icon name="sparkle" size={17}/></span>
      </button>

      <button type="button" className="profile-button" aria-label="Profile">
        <span className="avatar">W</span>
      </button>
    </aside>
  );
}

function Composer() {
  const [prompt, setPrompt] = useState('');
  const [sent, setSent] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!prompt.trim()) return;
    setSent(true);
    window.setTimeout(() => setSent(false), 2400);
  }

  return (
    <div className="composer-wrap">
      <form className="composer" onSubmit={submit}>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask Yakable to build..."
          aria-label="Describe what you want to build"
          rows={2}
        />
        <div className="composer-row">
          <button className="composer-icon-button" type="button" aria-label="Add attachment"><Icon name="plus" /></button>
          <div className="composer-actions">
            <button className="mode-button" type="button">Build <span>⌄</span></button>
            <button className="composer-icon-button" type="button" aria-label="Voice input"><Icon name="mic" /></button>
            <button className="send-button" type="submit" disabled={!prompt.trim()} aria-label="Send"><Icon name="send" /></button>
          </div>
        </div>
      </form>
      <div className={`composer-toast ${sent ? 'show' : ''}`}>UI shell ready — generation wiring comes next.</div>
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
          <div className="preview-hero-line wide"/>
          <div className="preview-hero-line"/>
          <div className="preview-button"/>
          <div className="preview-grid"><i/><i/><i/></div>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ title, edited, variant }: { title: string; edited: string; variant: string }) {
  return (
    <article className="project-card">
      <button className="project-thumb" type="button" aria-label={`Open ${title}`}>
        <ProjectPreview variant={variant} />
        <span className="favorite-button"><Icon name="star" size={16}/></span>
      </button>
      <div className="project-meta">
        <span className="project-avatar">Y</span>
        <div className="project-copy"><strong>{title}</strong><small>Edited {edited}</small></div>
        <button className="project-more" type="button" aria-label="More options">•••</button>
      </div>
    </article>
  );
}

function ProjectGallery() {
  const [activeTab, setActiveTab] = useState('My projects');
  const [query, setQuery] = useState('');
  const tabs = ['Search', 'My projects', 'Recently viewed', 'Yakable templates'];
  const visibleProjects = useMemo(() => {
    if (!query.trim()) return projects;
    return projects.filter((project) => project.title.toLowerCase().includes(query.toLowerCase()));
  }, [query]);

  return (
    <section className="gallery-panel">
      <div className="gallery-toolbar">
        <div className="gallery-tabs">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={activeTab === tab ? 'active' : ''}
            >
              {tab === 'Search' ? <Icon name="search" size={15}/> : null}
              {tab}
            </button>
          ))}
        </div>
        <button className="browse-button" type="button">Browse all <span>→</span></button>
      </div>

      {activeTab === 'Search' ? (
        <div className="gallery-search"><Icon name="search" size={16}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects" /></div>
      ) : null}

      <div className="project-grid">
        {visibleProjects.map((project) => <ProjectCard key={project.title} {...project} />)}
      </div>
    </section>
  );
}

export default function App() {
  return (
    <div className="dashboard-shell">
      <Sidebar />
      <div className="main-column">
        <main className="dashboard-surface">
          <section className="hero-section">
            <div className="hero-glow" aria-hidden="true"/>
            <div className="hero-content">
              <button className="announcement-pill" type="button"><span className="pill-dots"><i/><i/><i/></span>Build with DeepSeek <span>→</span></button>
              <h1>Got an idea?</h1>
              <p className="hero-subtitle">Describe it. Yakable will turn the idea into a working project.</p>
              <Composer />
            </div>
            <div className="hero-spark spark-one"/><div className="hero-spark spark-two"/>
          </section>
          <ProjectGallery />
        </main>
      </div>
    </div>
  );
}
