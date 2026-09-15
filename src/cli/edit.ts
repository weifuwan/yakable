import 'dotenv/config';

import { createDefaultAgentRuntime } from '../agent-runtime/agent-runtime.js';
import type { AgentProtocolItem } from '../protocol/agent-protocol.js';

function usage(): never {
  console.error(
    'Usage: npm run edit -- generated/<project-id> "Change the Hero title and make the primary color blue"',
  );
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

const [projectInput, ...requestParts] = process.argv.slice(2);
const followUpRequest = requestParts.join(' ').trim();
if (!projectInput || !followUpRequest) usage();

const agentRuntime = createDefaultAgentRuntime();

try {
  console.log('Yakable: Agent Runtime');
  console.log('Running the bounded edit workflow with structured agent items.');

  const result = await agentRuntime.editProject(projectInput, followUpRequest, {
    onEvent(item) {
      console.log(`[${itemLabel(item)}] ${item.status}: ${item.message}`);
    },
  });

  console.log(`\nProject: ${result.projectId}`);
  console.log(`Model: ${result.model}`);
  console.log(`Edit intent source: ${result.editIntent.source}`);
  console.log(`Edit intent scope: ${result.editIntent.delta.scope}`);
  console.log(`Edit intent: ${result.editIntent.delta.summary}`);
  for (const directive of result.editIntent.delta.directives) {
    console.log(`- ${directive.area} (${directive.basis}): ${directive.directive}`);
  }
  if (result.editIntent.delta.preserve.length) {
    console.log(`Preserve: ${result.editIntent.delta.preserve.join('; ')}`);
  }
  console.log(`Context source: ${result.contextSelection.source}`);
  if (result.contextSelection.searchQuery) console.log(`Search query: ${result.contextSelection.searchQuery}`);
  console.log(`Context files: ${result.contextSelection.relevantFiles.length}`);
  for (const file of result.contextSelection.relevantFiles) console.log(`- ${file}`);
  console.log(`Changed files: ${result.changedFiles.length}`);
  for (const file of result.changedFiles) console.log(`- ${file}`);
  console.log(`Summary: ${result.summary}`);

  console.log(`One-shot repair: ${result.repair.status}`);
  if (result.repair.attempted) {
    if (result.repair.model) console.log(`- Repair model: ${result.repair.model}`);
    console.log(`- Repair context files: ${result.repair.contextFiles.length}`);
    console.log(`- Repair changed files: ${result.repair.changedFiles.length}`);
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
  } else {
    console.log(`Project check: ERROR (${result.projectCheck.error.code})`);
    console.log(`- ${result.projectCheck.error.message}`);
  }
} catch (error) {
  console.error(`\nEdit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exitCode = 1;
}
