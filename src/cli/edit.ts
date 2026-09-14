import 'dotenv/config';

import { editGeneratedProject } from '../editing/edit.js';

function usage(): never {
  console.error(
    'Usage: npm run edit -- generated/<project-id> "Change the Hero title and make the primary color blue"',
  );
  process.exit(1);
}

const [projectInput, ...requestParts] = process.argv.slice(2);
const followUpRequest = requestParts.join(' ').trim();

if (!projectInput || !followUpRequest) {
  usage();
}

try {
  console.log('Yakable: Edit project');
  console.log('Selecting focused context, editing, checking health, and allowing at most one targeted repair.');

  const result = await editGeneratedProject(projectInput, followUpRequest);

  console.log(`\nProject: ${result.projectId}`);
  console.log(`Model: ${result.model}`);
  console.log(`Context source: ${result.contextSelection.source}`);
  if (result.contextSelection.searchQuery) {
    console.log(`Search query: ${result.contextSelection.searchQuery}`);
  }
  console.log(`Context files: ${result.contextSelection.relevantFiles.length}`);
  for (const file of result.contextSelection.relevantFiles) {
    console.log(`- ${file}`);
  }
  console.log(`Changed files: ${result.changedFiles.length}`);
  for (const file of result.changedFiles) {
    console.log(`- ${file}`);
  }
  console.log(`Summary: ${result.summary}`);

  console.log(`One-shot repair: ${result.repair.status}`);
  if (result.repair.attempted) {
    if (result.repair.model) console.log(`- Repair model: ${result.repair.model}`);
    console.log(`- Repair context files: ${result.repair.contextFiles.length}`);
    for (const file of result.repair.contextFiles) {
      console.log(`  - ${file}`);
    }
    console.log(`- Repair changed files: ${result.repair.changedFiles.length}`);
    for (const file of result.repair.changedFiles) {
      console.log(`  - ${file}`);
    }
    if (result.repair.summary) console.log(`- Repair summary: ${result.repair.summary}`);
    if (result.repair.error) console.log(`- Repair error: ${result.repair.error}`);
  } else if (result.repair.error) {
    console.log(`- ${result.repair.error}`);
  }

  if (result.projectCheck.ok) {
    console.log(`Project check: ${result.projectCheck.value.status}`);
    for (const check of result.projectCheck.value.checks) {
      console.log(`- ${check.phase}: ${check.status}`);
    }
    for (const diagnostic of result.projectCheck.value.diagnostics) {
      const location = diagnostic.path
        ? `${diagnostic.path}${diagnostic.line ? `:${diagnostic.line}${diagnostic.column ? `:${diagnostic.column}` : ''}` : ''}`
        : diagnostic.phase;
      const code = diagnostic.code ? ` ${diagnostic.code}` : '';
      console.log(`  ${location}${code}: ${diagnostic.message}`);
    }
  } else {
    console.log(`Project check: ERROR (${result.projectCheck.error.code})`);
    console.log(`- ${result.projectCheck.error.message}`);
  }

  console.log('\nRun `npm run run:project -- generated/<project-id>` separately to inspect the edited project in the browser.');
} catch (error) {
  console.error(`\nEdit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exitCode = 1;
}
