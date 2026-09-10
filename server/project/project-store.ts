const MAX_PROJECTS = 50;
const MAX_PROJECT_FILES = 120;
const MAX_FILE_BYTES = 120 * 1024;
const MAX_PROJECT_BYTES = 1024 * 1024;
const PROJECT_TTL_MS = 4 * 60 * 60 * 1000;

const WRITABLE_PREFIXES = ['src/', 'public/'];

export interface ProjectFileSummary {
  path: string;
  size: number;
  updatedAt: string;
}

export interface ProjectSnapshot {
  id: string;
  createdAt: string;
  updatedAt: string;
  files: ProjectFileSummary[];
}

interface StoredFile {
  content: string;
  updatedAt: number;
}

interface StoredProject {
  id: string;
  createdAt: number;
  updatedAt: number;
  files: Map<string, StoredFile>;
}

const projects = new Map<string, StoredProject>();

function templateFiles(): Record<string, string> {
  return {
    'package.json': `{
  "name": "yakable-generated-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "tsc -b && vite build",
    "preview": "vite preview --host 0.0.0.0"
  },
  "dependencies": {
    "lucide-react": "^1.43.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^6.1.1",
    "tailwindcss": "^4.3.3",
    "typescript": "^7.0.2",
    "vite": "^8.2.2"
  }
}
`,
    'index.html': `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Yakable App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    'tsconfig.json': `{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
`,
    'vite.config.ts': `import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
});
`,
    'src/main.tsx': `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
    'src/App.tsx': `export default function App() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
      <section className="max-w-xl text-center">
        <p className="text-sm font-medium text-zinc-400">Yakable</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-6xl">
          Describe what you want to build.
        </h1>
        <p className="mt-5 text-base leading-7 text-zinc-400">
          The coding agent will replace this starter screen with your product.
        </p>
      </section>
    </main>
  );
}
`,
    'src/index.css': `@import "tailwindcss";

:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #18181b;
  background: #ffffff;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

html {
  min-width: 320px;
  background: #ffffff;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button,
input,
textarea,
select {
  font: inherit;
}
`,
  };
}

function byteLength(value: string) {
  return Buffer.byteLength(value, 'utf8');
}

function normalizePath(input: string) {
  const path = input.trim().replace(/\\/g, '/').replace(/^\.\//, '');

  if (!path || path.length > 180 || path.startsWith('/')) {
    throw new Error('path must be a relative project path');
  }

  const segments = path.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    throw new Error('path contains an invalid segment');
  }

  if (path === '.env' || path.startsWith('.git/') || path.startsWith('node_modules/')) {
    throw new Error('path is not available to the generated project agent');
  }

  return path;
}

function assertWritablePath(path: string) {
  if (!WRITABLE_PREFIXES.some((prefix) => path.startsWith(prefix))) {
    throw new Error('Only src/ and public/ files are writable in the fixed MVP template');
  }
}

function totalProjectBytes(project: StoredProject, replacingPath?: string) {
  let total = 0;

  for (const [path, file] of project.files) {
    if (path !== replacingPath) {
      total += byteLength(file.content);
    }
  }

  return total;
}

function createProject(projectId: string): StoredProject {
  const now = Date.now();
  const files = new Map<string, StoredFile>();

  for (const [path, content] of Object.entries(templateFiles())) {
    files.set(path, { content, updatedAt: now });
  }

  return {
    id: projectId,
    createdAt: now,
    updatedAt: now,
    files,
  };
}

function sweepProjects(now = Date.now()) {
  for (const [projectId, project] of projects) {
    if (now - project.updatedAt > PROJECT_TTL_MS) {
      projects.delete(projectId);
    }
  }

  if (projects.size < MAX_PROJECTS) {
    return;
  }

  const oldest = [...projects.values()].sort((a, b) => a.updatedAt - b.updatedAt);
  const overflow = projects.size - MAX_PROJECTS + 1;

  for (const project of oldest.slice(0, overflow)) {
    projects.delete(project.id);
  }
}

function requireProject(projectId: string) {
  const project = projects.get(projectId);
  if (!project) {
    throw new Error(`Unknown project: ${projectId}`);
  }
  return project;
}

export function ensureProject(projectId: string) {
  sweepProjects();

  let project = projects.get(projectId);
  if (!project) {
    project = createProject(projectId);
    projects.set(projectId, project);
  }

  return getProjectSnapshot(projectId);
}

export function getProjectSnapshot(projectId: string): ProjectSnapshot {
  const project = requireProject(projectId);

  return {
    id: project.id,
    createdAt: new Date(project.createdAt).toISOString(),
    updatedAt: new Date(project.updatedAt).toISOString(),
    files: [...project.files.entries()]
      .map(([path, file]) => ({
        path,
        size: byteLength(file.content),
        updatedAt: new Date(file.updatedAt).toISOString(),
      }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  };
}

export function readProjectFile(projectId: string, inputPath: string) {
  const path = normalizePath(inputPath);
  const project = requireProject(projectId);
  const file = project.files.get(path);

  if (!file) {
    throw new Error(`File not found: ${path}`);
  }

  return {
    path,
    content: file.content,
    size: byteLength(file.content),
  };
}

export function writeProjectFile(projectId: string, inputPath: string, content: string) {
  const path = normalizePath(inputPath);
  assertWritablePath(path);

  const project = requireProject(projectId);
  const size = byteLength(content);

  if (size > MAX_FILE_BYTES) {
    throw new Error(`File exceeds the ${MAX_FILE_BYTES}-byte limit`);
  }

  if (!project.files.has(path) && project.files.size >= MAX_PROJECT_FILES) {
    throw new Error(`Project exceeds the ${MAX_PROJECT_FILES}-file limit`);
  }

  const nextTotal = totalProjectBytes(project, path) + size;
  if (nextTotal > MAX_PROJECT_BYTES) {
    throw new Error(`Project exceeds the ${MAX_PROJECT_BYTES}-byte source limit`);
  }

  const now = Date.now();
  project.files.set(path, { content, updatedAt: now });
  project.updatedAt = now;

  return {
    path,
    size,
    updatedAt: new Date(now).toISOString(),
  };
}
