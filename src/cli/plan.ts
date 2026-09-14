import 'dotenv/config';

import {
  draftProjectPlan,
  readProjectPlan,
  reviewProjectPlan,
} from '../planning/plan-artifact.js';
import {
  readProjectPlanDiff,
  replanProjectPlan,
} from '../planning/replan.js';

function usage(): never {
  console.error(
    [
      'Usage:',
      '  npm run plan -- generated/<project-id> draft "Plan the requested frontend change"',
      '  npm run plan -- generated/<project-id> replan "Revise the plan with this feedback"',
      '  npm run plan -- generated/<project-id> revise "Alias for replan"',
      '  npm run plan -- generated/<project-id> diff [fromRevision] [toRevision]',
      '  npm run plan -- generated/<project-id> show',
      '  npm run plan -- generated/<project-id> approve [review note]',
      '  npm run plan -- generated/<project-id> reject [review note]',
    ].join('\n'),
  );
  process.exit(1);
}

function optionalRevision(value: string | undefined, field: string): number | undefined {
  if (value === undefined) return undefined;
  const revision = Number(value);
  if (!Number.isInteger(revision) || revision < 1) {
    throw new Error(`${field} must be a positive integer.`);
  }
  return revision;
}

const [projectInput, rawAction, ...rest] = process.argv.slice(2);
if (!projectInput || !rawAction) usage();

const action = rawAction.toLowerCase();
const text = rest.join(' ').trim();

try {
  if (action === 'draft') {
    if (!text) usage();
    console.log('Yakable: Draft Plan Artifact');
    console.log('PLAN mode may read/search project context and plan UI, but cannot mutate project source.');
    const result = await draftProjectPlan(projectInput, text, { mode: 'PLAN' });
    console.log(`\nPlan model: ${result.model}`);
    console.log(`UI Planner model: ${result.uiPlannerModel}`);
    console.log(`UI Planner: ${result.uiPlanner.status}`);
    console.log(`Context: ${result.contextSelection.relevantFiles.length} file(s)`);
    console.log(`Revision: ${result.plan.revision}`);
    console.log(`Status: ${result.plan.status}\n`);
    console.log(result.markdown);
  } else if (action === 'replan' || action === 'revise') {
    if (!text) usage();
    console.log('Yakable: Re-plan');
    console.log('The superseded revision will be archived before the new DRAFT replaces plan.json.');
    const result = await replanProjectPlan(projectInput, text, { mode: 'PLAN' });
    console.log(`\nPlan model: ${result.model}`);
    console.log(`UI Planner model: ${result.uiPlannerModel}`);
    console.log(`UI Planner: ${result.uiPlanner.status}`);
    console.log(`Context: ${result.contextSelection.relevantFiles.length} file(s)`);
    console.log(`Revision: ${result.previousPlan.revision} -> ${result.plan.revision}`);
    console.log(`Status: ${result.plan.status}\n`);
    console.log(result.markdown);
    console.log('\n' + result.diffMarkdown);
  } else if (action === 'diff') {
    if (rest.length > 2) usage();
    const result = await readProjectPlanDiff(projectInput, {
      mode: 'PLAN',
      fromRevision: optionalRevision(rest[0], 'fromRevision'),
      toRevision: optionalRevision(rest[1], 'toRevision'),
    });
    if (!result) {
      console.log('No Plan Artifact exists for this project.');
    } else {
      console.log(result.markdown);
    }
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
