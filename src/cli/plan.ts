import 'dotenv/config';

import {
  draftProjectPlan,
  readProjectPlan,
  reviewProjectPlan,
} from '../planning/plan-artifact.js';

function usage(): never {
  console.error(
    [
      'Usage:',
      '  npm run plan -- generated/<project-id> draft "Plan the requested frontend change"',
      '  npm run plan -- generated/<project-id> revise "Revise the plan with this feedback"',
      '  npm run plan -- generated/<project-id> show',
      '  npm run plan -- generated/<project-id> approve [review note]',
      '  npm run plan -- generated/<project-id> reject [review note]',
    ].join('\n'),
  );
  process.exit(1);
}

const [projectInput, rawAction, ...rest] = process.argv.slice(2);
if (!projectInput || !rawAction) usage();

const action = rawAction.toLowerCase();
const text = rest.join(' ').trim();

try {
  if (action === 'draft' || action === 'revise') {
    if (!text) usage();
    console.log(`Yakable: ${action === 'draft' ? 'Draft' : 'Revise'} Plan Artifact`);
    console.log('PLAN mode may read/search project context but cannot mutate project source.');
    const result = await draftProjectPlan(projectInput, text, { mode: 'PLAN' });
    console.log(`\nModel: ${result.model}`);
    console.log(`Context: ${result.contextSelection.relevantFiles.length} file(s)`);
    console.log(`Revision: ${result.plan.revision}`);
    console.log(`Status: ${result.plan.status}\n`);
    console.log(result.markdown);
  } else if (action === 'show') {
    const result = await readProjectPlan(projectInput, { mode: 'PLAN' });
    if (!result) {
      console.log('No Plan Artifact exists for this project.');
    } else {
      console.log(result.markdown);
    }
  } else if (action === 'approve' || action === 'reject') {
    const result = await reviewProjectPlan(
      projectInput,
      action === 'approve' ? 'APPROVE' : 'REJECT',
      text || undefined,
      { mode: 'PLAN' },
    );
    console.log(result.markdown);
  } else {
    usage();
  }
} catch (error) {
  console.error(`\nPlan failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exitCode = 1;
}
