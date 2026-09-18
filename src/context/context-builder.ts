import {
  assertWithinContextBudget,
  createContextBudget,
  type ContextBudget,
} from './context-budget.js';
import {
  CONTEXT_SNAPSHOT_VERSION,
  type ContextBuildRequest,
  type ContextContribution,
  type ContextJsonValue,
  type ContextSection,
  type ContextSnapshot,
} from './context-contract.js';
import { estimateTextTokens } from './token-estimator.js';

export type ContextProviderResult =
  | ContextContribution
  | readonly ContextContribution[]
  | null
  | undefined;

export interface ContextProvider {
  id: string;
  provide(
    request: Readonly<ContextBuildRequest>,
  ): ContextProviderResult | Promise<ContextProviderResult>;
}

export interface ContextBuilderOptions {
  budget: ContextBudget;
  providers?: readonly ContextProvider[];
  now?: () => Date;
}

function normalizeRequiredText(value: string, name: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${name} is required.`);
  return normalized;
}

function normalizeContent(content: ContextJsonValue): ContextJsonValue {
  if (typeof content !== 'string') return content;
  const normalized = content.trim();
  if (!normalized) throw new Error('Context contribution content must not be blank.');
  return normalized;
}

function normalizeProvider(provider: ContextProvider): ContextProvider {
  return {
    ...provider,
    id: normalizeRequiredText(provider.id, 'Context provider id'),
  };
}

function normalizeContribution(
  providerId: string,
  contribution: ContextContribution,
): ContextSection {
  return {
    ...contribution,
    id: normalizeRequiredText(contribution.id, 'Context contribution id'),
    source: providerId,
    pinned: contribution.pinned ?? false,
    content: normalizeContent(contribution.content),
    ...(contribution.metadata ? { metadata: { ...contribution.metadata } } : {}),
  };
}

function contributionsFromProviderResult(
  provided: ContextProviderResult,
): readonly ContextContribution[] {
  if (provided == null) return [];
  if (Array.isArray(provided)) {
    return provided as readonly ContextContribution[];
  }
  return [provided as ContextContribution];
}

export class ContextBuilder {
  private readonly budget: ContextBudget;
  private readonly providers: readonly ContextProvider[];
  private readonly now: () => Date;

  constructor(options: ContextBuilderOptions) {
    this.budget = createContextBudget(options.budget);
    this.providers = (options.providers ?? []).map(normalizeProvider);
    this.now = options.now ?? (() => new Date());

    const providerIds = new Set<string>();
    for (const provider of this.providers) {
      if (providerIds.has(provider.id)) {
        throw new Error(`Duplicate Context provider id: ${provider.id}`);
      }
      providerIds.add(provider.id);
    }
  }

  async build(input: ContextBuildRequest): Promise<ContextSnapshot> {
    const request = normalizeRequiredText(input.request, 'Context request');
    const projectInput = input.projectInput?.trim();
    const normalizedInput: ContextBuildRequest = {
      operation: input.operation,
      request,
      ...(projectInput ? { projectInput } : {}),
      ...(input.metadata ? { metadata: { ...input.metadata } } : {}),
    };

    const sections: ContextSection[] = [];
    const sectionIds = new Set<string>();

    for (const provider of this.providers) {
      const provided = await provider.provide(normalizedInput);
      for (const contribution of contributionsFromProviderResult(provided)) {
        const section = normalizeContribution(provider.id, contribution);
        if (sectionIds.has(section.id)) {
          throw new Error(`Duplicate Context section id: ${section.id}`);
        }
        sectionIds.add(section.id);
        sections.push(section);
      }
    }

    const estimatedInputTokens = estimateTextTokens(JSON.stringify({
      operation: normalizedInput.operation,
      request: normalizedInput.request,
      projectInput: normalizedInput.projectInput ?? null,
      metadata: normalizedInput.metadata ?? null,
      sections,
    }));
    const usage = assertWithinContextBudget(
      this.budget,
      estimatedInputTokens,
      'Context snapshot',
    );

    return {
      version: CONTEXT_SNAPSHOT_VERSION,
      operation: normalizedInput.operation,
      request: normalizedInput.request,
      ...(normalizedInput.projectInput ? { projectInput: normalizedInput.projectInput } : {}),
      ...(normalizedInput.metadata ? { metadata: normalizedInput.metadata } : {}),
      sections,
      budget: { ...this.budget },
      usage,
      createdAt: this.now().toISOString(),
    };
  }
}
