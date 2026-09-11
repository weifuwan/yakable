import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import { createServer, type ViteDevServer } from 'vite';

const REQUIRED_RUNTIME_FILES = ['package.json', 'index.html', 'src/main.tsx', 'src/App.tsx'] as const;
const DEFAULT_RUNTIME_PORT = 5173;

export interface ResolvedGeneratedProject {
  directory: string;
  id: string;
}

export interface StartedGeneratedProject extends ResolvedGeneratedProject {
  server: ViteDevServer;
  url: string;
}

export interface StartGeneratedProjectOptions {
  port?: number;
  sharedNodeModules?: string;
}

function isInsideDirectory(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative.length > 0 &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

async function assertRuntimeFiles(projectDirectory: string): Promise<void> {
  for (const requiredPath of REQUIRED_RUNTIME_FILES) {
    const target = path.join(projectDirectory, ...requiredPath.split('/'));
    const info = await stat(target).catch(() => null);
    if (!info?.isFile()) {
      throw new Error(`Generated project is missing runtime file: ${requiredPath}`);
    }
  }

  const rawPackage = await readFile(path.join(projectDirectory, 'package.json'), 'utf8');
  try {
    const value: unknown = JSON.parse(rawPackage);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('package.json must contain a JSON object.');
    }
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Generated project package.json is not valid JSON.');
    }
    throw error;
  }
}

export async function resolveGeneratedProject(
  input: string,
  generatedRoot = path.resolve(process.cwd(), 'generated'),
): Promise<ResolvedGeneratedProject> {
  const requested = input.trim();
  if (!requested) {
    throw new Error('A generated project path or project id is required.');
  }

  const root = await realpath(generatedRoot).catch(() => {
    throw new Error(`Generated project root does not exist: ${generatedRoot}`);
  });

  let candidate: string;
  if (path.isAbsolute(requested)) {
    candidate = requested;
  } else {
    const fromWorkingDirectory = path.resolve(process.cwd(), requested);
    candidate = isInsideDirectory(root, fromWorkingDirectory)
      ? fromWorkingDirectory
      : path.join(root, requested);
  }

  const directory = await realpath(candidate).catch(() => {
    throw new Error(`Generated project does not exist: ${requested}`);
  });

  if (!isInsideDirectory(root, directory)) {
    throw new Error('Stage 2 can only run projects inside the generated/ directory.');
  }

  const info = await stat(directory);
  if (!info.isDirectory()) {
    throw new Error(`Generated project path is not a directory: ${requested}`);
  }

  await assertRuntimeFiles(directory);

  return {
    directory,
    id: path.basename(directory),
  };
}

export async function startGeneratedProject(
  project: ResolvedGeneratedProject,
  options: StartGeneratedProjectOptions = {},
): Promise<StartedGeneratedProject> {
  const sharedNodeModules = options.sharedNodeModules ?? path.resolve(process.cwd(), 'node_modules');
  const port = options.port ?? DEFAULT_RUNTIME_PORT;

  const server = await createServer({
    root: project.directory,
    configFile: false,
    clearScreen: false,
    logLevel: 'info',
    esbuild: {
      jsx: 'automatic',
      jsxImportSource: 'react',
    },
    server: {
      host: '127.0.0.1',
      port,
      strictPort: false,
      fs: {
        strict: true,
        allow: [project.directory, sharedNodeModules],
      },
    },
  });

  try {
    await server.listen();
  } catch (error) {
    await server.close();
    throw error;
  }

  const url = server.resolvedUrls?.local[0];
  if (!url) {
    await server.close();
    throw new Error('Vite started but did not expose a local runtime URL.');
  }

  return {
    ...project,
    server,
    url,
  };
}
