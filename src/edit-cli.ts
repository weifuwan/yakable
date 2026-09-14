import 'dotenv/config';

import { editGeneratedProject } from './edit.js';

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
  console.log('Editing the existing source only; Yakable will not run or automatically repair the project.');

  const result = await editGeneratedProject(projectInput, followUpRequest);

  console.log(`\nProject: ${result.projectId}`);
  console.log(`Model: ${result.model}`);
  console.log(`Changed files: ${result.changedFiles.length}`);
  for (const file of result.changedFiles) {
    console.log(`- ${file}`);
  }
  console.log(`Summary: ${result.summary}`);
  console.log('\nRun `npm run run:project -- generated/<project-id>` separately to inspect the edited project in the browser.');
} catch (error) {
  console.error(`\nEdit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exitCode = 1;
}
