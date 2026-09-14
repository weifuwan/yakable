import 'dotenv/config';

import { buildProjectFromApprovedPlan } from '../planning/approved-plan-build.js';

function usage(): never {
  console.error('Usage: npm run build:plan -- generated/<project-id>');
  process.exit(1);
}

const [projectInput, ...rest] = process.argv.slice(2);
if (!projectInput || rest.length > 0) usage();

try {
  console.log('Yakable: Build From Approved Plan');
  const result = await buildProjectFromApprovedPlan(projectInput, {
    onEvent(event) {
      console.log(`[${event.state}] ${event.status}: ${event.message}`);
    },
  });

  console.log(`\nPlan revision: ${result.executionPlan.source.revision}`);
  console.log(`Plan fingerprint: ${result.executionPlan.source.fingerprint}`);
  console.log(`Model: ${result.model}`);
  console.log(`Changed files: ${result.changedFiles.length}`);
  for (const file of result.changedFiles) console.log(`- ${file}`);
  console.log(`Summary: ${result.summary}`);

  if (result.projectCheck.ok) {
    console.log(`Project check: ${result.projectCheck.value.status}`);
  } else {
    console.log(`Project check: ERROR (${result.projectCheck.error.code})`);
    console.log(`- ${result.projectCheck.error.message}`);
  }

  if (result.repair.attempted) {
    console.log(`One-shot repair: ${result.repair.status}`);
  }
} catch (error) {
  console.error(`\nApproved Plan Build failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exitCode = 1;
}
