import type { ContextBudget } from './context-budget.js';
import {
  CONTEXT_SNAPSHOT_VERSION,
  type ContextBuildRequest,
  type ContextContribution,
  type ContextJsonValue,
  type ContextSection,
  type ContextSnapshot,
} from './context-contract.js';

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

export class ContextBuilder {
  private readonly budget: ContextBudget;
  private readonly providers: readonly ContextProvider[];
  private readonly now: () => Date;

  constructor(options: ContextBuilderOptions) {
    this.budget = { ...options.budget };
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
      const contributions = provided == null
        ? []
        : Array.isArray(provided)
          ? provided
          : [provided];

      for (const contribution of contributions) {
        const section = normalizeContribution(provider.id, contribution);
        if (sectionIds.has(section.id)) {
          throw new Error(`Duplicate Context section id: ${section.id}`);
        }
        sectionIds.add(section.id);
        sections.push(section);
      }
    }

    return {
      version: CONTEXT_SNAPSHOT_VERSION,
      operation: normalizedInput.operation,
      request: normalizedInput.request,
      ...(normalizedInput.projectInput ? { projectInput: normalizedInput.projectInput } : {}),
      ...(normalizedInput.metadata ? { metadata: normalizedInput.metadata } : {}),
      sections,
      budget: { ...this.budget },
      createdAt: this.now().toISOString(),
    };
  }
}
