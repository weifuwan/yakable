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

function createMockApp(request: string) {
  const requestLiteral = JSON.stringify(request);

  return `const request = ${requestLiteral};

const features = [
  ['Fast by default', 'A focused React, Vite and Tailwind foundation without setup noise.'],
  ['Made to iterate', 'Keep refining the product through the Yakable conversation.'],
  ['Ready for Preview', 'The next MVP slice will run this source inside an isolated Sandbox.'],
];

export default function App() {
  return (
    <main className="min-h-screen bg-[#09090b] text-white">
      <section className="mx-auto flex min-h-[72vh] max-w-6xl flex-col justify-center px-6 py-20 sm:px-10">
        <span className="w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
          Generated with Yakable
        </span>
        <h1 className="mt-7 max-w-4xl text-5xl font-semibold tracking-[-0.055em] sm:text-7xl">
          Your idea is now a real React project.
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-7 text-zinc-400 sm:text-lg">
          {request}
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <button className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200">
            Start building
          </button>
          <button className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/5">
            View source
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
  readonly model = 'yakable-project-generation-mock';

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
              summary: `Generate the React UI for: ${request}`,
              steps: [
                'Inspect the fixed React/Vite/Tailwind project scaffold.',
                'Read the starter application and global styles.',
                'Replace the starter screen with the requested product UI.',
                'Leave runtime verification for the Sandbox phase.',
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
          {
            type: 'tool_use',
            id: 'mock-read-styles',
            name: 'read_file',
            input: { path: 'src/index.css' },
          },
        ],
        stopReason: 'tool_use',
      };
    }

    if (!hasToolResult(input.messages, 'write_file')) {
      const request = getLatestUserRequest(input.messages);

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
          text:
            'I generated the React project source and replaced src/App.tsx plus src/index.css for your request. The files are now stored in Yakable’s project workspace; runtime/build verification and a real live preview intentionally wait for the Sandbox PR.',
        },
      ],
      stopReason: 'end_turn',
    };
  }
}
