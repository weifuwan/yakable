import 'dotenv/config';

import { buildProjectFromApprovedPlan } from '../planning/approved-plan-build.js';
import type { AgentProtocolItem } from '../protocol/agent-protocol.js';

function usage(): never {
  console.error('Usage: npm run build:plan -- generated/<project-id>');
  process.exit(1);
}

function itemLabel(item: AgentProtocolItem): string {
  if (item.type === 'progress') return item.state;
  if (item.type === 'tool_call') return `tool:${item.toolName}`;
  if (item.type === 'file_change') return 'file_change';
  if (item.type === 'command_execution') return `command:${item.phase ?? 'run'}`;
  if (item.type === 'check_result') return `check:${item.result}`;
  return 'agent_message';
}

const [projectInput, ...rest] = process.argv.slice(2);
if (!projectInput || rest.length > 0) usage();

try {
  console.log('Yakable: Build From Approved Plan');
  const result = await buildProjectFromApprovedPlan(projectInput, {
    onEvent(item) {
      console.log(`[${itemLabel(item)}] ${item.status}: ${item.message}`);
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
