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
  console.log('Starting one server-owned edit run.');

  const result = await agentRuntime.beginEditRun(projectInput, followUpRequest, {
    onItem(item) {
      console.log(`[${itemLabel(item)}] ${item.status}: ${item.message}`);
    },
  });

  console.log(`\nRun: ${result.runId}`);
  console.log(`Project: ${result.projectId}`);
  console.log(`Status: ${result.status}`);
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

  if (result.status === 'WAITING_FOR_CLIENT_TOOL' && result.clientTool) {
    console.log(`Client tool required: ${result.clientTool.toolName}`);
    console.log(`Tool call id: ${result.clientTool.toolCallId}`);
    console.log('The run remains persisted and must be continued by a Preview-capable client.');
  } else if (result.visualFeedback) {
    console.log(`Visual feedback: ${result.visualFeedback.status}`);
  }
} catch (error) {
  console.error(`\nEdit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  process.exitCode = 1;
}
