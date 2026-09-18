import 'dotenv/config';

import { resolveGeneratedProject } from '../runtime/runtime.js';
import { checkProjectTool } from '../tools/check-project.js';

function usage(): never {
  console.error('Usage: npm run check:project -- generated/<project-id>');
  process.exit(1);
}

const [projectInput] = process.argv.slice(2);
if (!projectInput) usage();

try {
  const project = await resolveGeneratedProject(projectInput);
  const result = await checkProjectTool.execute({}, { projectDirectory: project.directory });

  console.log(`Yakable: Check project\nProject: ${project.id}`);

  if (!result.ok) {
    console.error(`Project check: ERROR (${result.error.code})`);
    console.error(result.error.message);
    process.exitCode = 1;
  } else {
    console.log(`Project check: ${result.value.status}`);
    for (const check of result.value.checks) {
      console.log(`- ${check.phase}: ${check.status}`);
    }
    for (const diagnostic of result.value.diagnostics) {
      const location = diagnostic.path
        ? `${diagnostic.path}${diagnostic.line ? `:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ''}` : ''}`
        : diagnostic.phase;
      const code = diagnostic.code ? ` ${diagnostic.code}` : '';
      console.log(`  ${location}${code}: ${diagnostic.message}`);
    }
    if (result.value.status === 'FAIL') process.exitCode = 1;
  }
} catch (error) {
  console.error(`Project check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exitCode = 1;
}
