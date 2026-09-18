export type AgentConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

export type GenerateAppInput = {
  prompt: string;
  currentApp: string;
};

export type GeneratedFile = {
  path: "src/App.tsx";
  content: string;
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

export class AgentConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentConfigurationError";
  }
}

export class AgentResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgentResponseError";
  }
}

const SYSTEM_PROMPT = `You are the code generation engine for Yakable.

The project is fixed:
- Vite
- React
- TypeScript
- Tailwind CSS v4

You are allowed to modify exactly one file:
- src/App.tsx

Hard rules:
- Do not modify or propose changes to any other file.
- Do not add dependencies.
- Only import from "react" when an import is needed.
- Use Tailwind utility classes for styling.
- The result must be a complete compilable src/App.tsx.
- The result must have a default export for App.
- Do not return markdown.
- Do not return explanations.
- Return exactly one JSON object in this shape:
  {"content":"<complete src/App.tsx source>"}`;

export class AgentService {
  constructor(private readonly config: AgentConfig) {}

  async generateApp(input: GenerateAppInput): Promise<GeneratedFile> {
    this.assertConfigured();

    const response = await fetch(
      `${this.config.baseUrl.replace(/\/+$/, "")}/chat/completions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            {
              role: "system",
              content: SYSTEM_PROMPT,
            },
            {
              role: "user",
              content: [
                "User request:",
                input.prompt,
                "",
                "Current src/App.tsx:",
                input.currentApp,
              ].join("\n"),
            },
          ],
          temperature: 0.2,
        }),
      },
    );

    if (!response.ok) {
      throw new AgentResponseError(
        `AI request failed with status ${response.status}.`,
      );
    }

    const body = (await response.json()) as ChatCompletionResponse;
    const message = body.choices?.[0]?.message?.content;

    if (!message) {
      throw new AgentResponseError("AI returned an empty response.");
    }

    const content = parseGeneratedContent(message);
    validateGeneratedApp(content);

    return {
      path: "src/App.tsx",
      content,
    };
  }

  private assertConfigured(): void {
    const missing = [
      !this.config.baseUrl ? "AI_BASE_URL" : null,
      !this.config.apiKey ? "AI_API_KEY" : null,
      !this.config.model ? "AI_MODEL" : null,
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new AgentConfigurationError(
        `Missing AI configuration: ${missing.join(", ")}`,
      );
    }
  }
}

function parseGeneratedContent(message: string): string {
  const normalized = message
    .trim()
    .replace(/^\`\`\`(?:json)?\s*/i, "")
    .replace(/\s*\`\`\`$/, "");

  let parsed: unknown;

  try {
    parsed = JSON.parse(normalized);
  } catch {
    throw new AgentResponseError("AI response is not valid JSON.");
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("content" in parsed) ||
    typeof parsed.content !== "string"
  ) {
    throw new AgentResponseError(
      'AI response must be {"content":"<complete src/App.tsx source>"}.',
    );
  }

  return parsed.content.trim();
}

function validateGeneratedApp(content: string): void {
  if (!content) {
    throw new AgentResponseError("Generated App.tsx is empty.");
  }

  if (!/export\s+default\s+(?:App|function\s+App)/.test(content)) {
    throw new AgentResponseError(
      "Generated App.tsx must default-export App.",
    );
  }

  const imports = [
    ...content.matchAll(/from\s+["']([^"']+)["']/g),
    ...content.matchAll(/import\s+["']([^"']+)["']/g),
  ].map((match) => match[1]);

  const unsupportedImport = imports.find((source) => source !== "react");

  if (unsupportedImport) {
    throw new AgentResponseError(
      `Generated App.tsx imports unsupported dependency "${unsupportedImport}".`,
    );
  }
}
