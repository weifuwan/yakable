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

function textUserRequestCount(messages: ProviderMessage[]) {
  return messages.filter(
    (message) =>
      message.role === 'user' && message.content.some((block) => block.type === 'text'),
  ).length;
}

function readFileToolContent(messages: ProviderMessage[], path: string) {
  for (let messageIndex = messages.length - 1; messageIndex >= 0; messageIndex -= 1) {
    const message = messages[messageIndex];

    for (const block of message.content) {
      if (block.type !== 'tool_result' || block.toolName !== 'read_file') {
        continue;
      }

      try {
        const payload = JSON.parse(block.content) as { path?: unknown; content?: unknown };
        if (payload.path === path && typeof payload.content === 'string') {
          return payload.content;
        }
      } catch {
        // The deterministic mock simply falls back to a whole-file write.
      }
    }
  }

  return undefined;
}

function isRepairRequest(messages: ProviderMessage[]) {
  return getLatestUserRequest(messages).startsWith('[Yakable automatic repair pass');
}

function requestDeclaration(content: string) {
  return content.match(/^const request = .*;$/m)?.[0];
}

function createMockApp(request: string) {
  const requestLiteral = JSON.stringify(request);

  return `const request = ${requestLiteral};

const features = [
  ['Fast by default', 'A focused React, Vite and Tailwind foundation without setup noise.'],
  ['Made to iterate', 'Keep refining the same project through the Yakable conversation.'],
  ['Auto repair', 'Yakable validates generated modules and can repair Preview failures automatically.'],
];

export default function App() {
  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <section className="mx-auto flex min-h-[72vh] max-w-6xl flex-col justify-center px-6 py-20 sm:px-10">
        <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
          Generated with Yakable
        </span>
        <h1 className="mt-7 max-w-4xl text-5xl font-semibold tracking-[-0.055em] sm:text-7xl">
          Your idea keeps getting better.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
          {request}
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <button className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200">
            Start building
          </button>
          <button className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5">
            Keep refining
          </button>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-3 px-6 pb-20 sm:grid-cols-3 sm:px-10">
        {features.map(([title, description], index) => (
          <article key={title} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <span className="text-xs font-semibold text-zinc-500">0{index + 1}</span>
            <h2 className="mt-8 text-lg font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-400">{description}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
`;
}

const mockStyles = `@import "tailwindcss";

:root {
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #fafafa;
  background: #09090b;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
}

button {
  font: inherit;
}
`;

export class MockProvider implements AIProvider {
  readonly name = 'mock';
  readonly model = 'yakable-iterative-repair-mock';

  async generate(input: ProviderGenerateInput): Promise<ProviderResponse> {
    const repair = isRepairRequest(input.messages);

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
              summary: repair ? 'Repair the Preview Runtime failure' : `Update the React UI for: ${request}`,
              steps: repair
                ? [
                    'Inspect the persistent project.',
                    'Read the source implicated by the runtime error.',
                    'Apply the smallest safe source fix.',
                    'Let Yakable validate the Preview Runtime again.',
                  ]
                : [
                    'Inspect the persistent React/Vite/Tailwind project.',
                    'Read the relevant existing application and styles.',
                    'Preserve unrelated UI and make the requested edit.',
                    'Let Yakable validate and refresh the Preview Runtime.',
                  ],
            },
          },
        ],
        stopReason: 'tool_use',
      };
    }

    if (!hasToolResult(input.messages, 'read_file')) {
      return {
        content: [
          {
            type: 'tool_use',
            id: 'mock-read-app',
            name: 'read_file',
            input: { path: 'src/App.tsx' },
          },
          ...(repair
            ? []
            : [
                {
                  type: 'tool_use' as const,
                  id: 'mock-read-styles',
                  name: 'read_file',
                  input: { path: 'src/index.css' },
                },
              ]),
        ],
        stopReason: 'tool_use',
      };
    }

    if (
      !hasToolResult(input.messages, 'write_file') &&
      !hasToolResult(input.messages, 'replace_in_file')
    ) {
      const appContent = readFileToolContent(input.messages, 'src/App.tsx');

      if (repair && appContent?.includes('__YAKABLE_BROKEN_JSX__')) {
        return {
          content: [
            {
              type: 'tool_use',
              id: 'mock-repair-app',
              name: 'replace_in_file',
              input: {
                path: 'src/App.tsx',
                oldText: '__YAKABLE_BROKEN_JSX__',
                newText: '<main>Recovered by Yakable</main>',
              },
            },
          ],
          stopReason: 'tool_use',
        };
      }

      if (repair) {
        return {
          content: [
            {
              type: 'tool_use',
              id: 'mock-repair-fallback',
              name: 'write_file',
              input: {
                path: 'src/App.tsx',
                content:
                  'export default function App() { return <main className="grid min-h-screen place-items-center">Preview repaired by Yakable.</main>; }\n',
              },
            },
          ],
          stopReason: 'tool_use',
        };
      }

      const request = getLatestUserRequest(input.messages);
      const existingDeclaration = appContent ? requestDeclaration(appContent) : undefined;
      const followUp = textUserRequestCount(input.messages) > 1;

      if (followUp && existingDeclaration) {
        return {
          content: [
            {
              type: 'tool_use',
              id: 'mock-incremental-request-edit',
              name: 'replace_in_file',
              input: {
                path: 'src/App.tsx',
                oldText: existingDeclaration,
                newText: `const request = ${JSON.stringify(request)};`,
              },
            },
          ],
          stopReason: 'tool_use',
        };
      }

      return {
        content: [
          {
            type: 'tool_use',
            id: 'mock-write-app',
            name: 'write_file',
            input: {
              path: 'src/App.tsx',
              content: createMockApp(request),
            },
          },
          {
            type: 'tool_use',
            id: 'mock-write-styles',
            name: 'write_file',
            input: {
              path: 'src/index.css',
              content: mockStyles,
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
          text: repair
            ? 'I applied a focused source repair for the Preview Runtime failure. Yakable will validate the generated modules again before marking the Preview live.'
            : 'I updated the existing project while preserving unrelated source. Yakable will now validate the generated modules and refresh the controlled live Preview.',
        },
      ],
      stopReason: 'end_turn',
    };
  }
}
