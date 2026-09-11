import 'dotenv/config';

import { resolveGeneratedProject, startGeneratedProject } from './runtime.js';

function usage(): string {
  return 'Usage: npm run run:project -- generated/<project-id>';
}

async function main(): Promise<void> {
  const projectInput = process.argv.slice(2).join(' ').trim();
  if (!projectInput) {
    throw new Error(usage());
  }

  console.log('Yakable Stage 2: Code -> Run');
  console.log('Starting a controlled local Vite runtime; generated package scripts will not run.');
  console.log('');

  const project = await resolveGeneratedProject(projectInput);
  console.log(`Project: ${project.id}`);

  const runtime = await startGeneratedProject(project);
  console.log('');
  console.log('Runtime ready');
  console.log(runtime.url);
  console.log('');
  console.log('Open the URL in your browser. Press Ctrl+C to stop the runtime.');

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    console.log('\nStopping runtime...');
    await runtime.server.close();
  };

  process.once('SIGINT', () => {
    void shutdown();
  });
  process.once('SIGTERM', () => {
    void shutdown();
  });
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Runtime failed: ${message}`);
  process.exitCode = 1;
});
