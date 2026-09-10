import type {
  AIProvider,
  ProviderGenerateInput,
  ProviderMessage,
  ProviderResponse,
} from './types.js';

function hasToolResult(messages: ProviderMessage[], toolName: string) {
  return messages.some((message) =>
    message.content.some(
      (block) => block.type === 'tool_result' && block.toolName === toolName,
    ),
  );
}

function getLatestUserRequest(messages: ProviderMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];

    if (message.role !== 'user') {
      continue;
    }

    const text = message.content.find((block) => block.type === 'text');
    if (text?.type === 'text') {
      return text.text;
    }
  }

  return 'Build the requested application';
}

export class MockProvider implements AIProvider {
  readonly name = 'mock';
  readonly model = 'yakable-foundation-mock';

  async generate(input: ProviderGenerateInput): Promise<ProviderResponse> {
    if (!hasToolResult(input.messages, 'inspect_workspace')) {
      return {
        content: [
          {
            type: 'tool_use',
            id: 'mock-inspect-workspace',
            name: 'inspect_workspace',
            input: {},
          },
        ],
        stopReason: 'tool_use',
      };
    }

    if (!hasToolResult(input.messages, 'set_plan')) {
      const request = getLatestUserRequest(input.messages);

      return {
        content: [
          {
            type: 'tool_use',
            id: 'mock-set-plan',
            name: 'set_plan',
            input: {
              summary: `Prepare Yakable to implement: ${request}`,
              steps: [
                'Inspect the current project boundary and fixed frontend stack.',
                'Identify the files and components that will need to change.',
                'Apply the code changes once writable project tools are available.',
                'Run typecheck and build verification after the edit.',
              ],
            },
          },
        ],
        stopReason: 'tool_use',
      };
    }

    return {
      content: [
        {
          type: 'text',
          text:
            'I inspected the Yakable workspace and prepared an implementation plan. PR 2 now has a working Agent loop and tool boundary; file writes and command execution remain intentionally disabled until the project-generation/Sandbox phase.',
        },
      ],
      stopReason: 'end_turn',
    };
  }
}
