import type {
  DesignIntentDirective,
  DesignIntentIR,
  DesignIntentOpenQuestion,
  DesignIntentOpenQuestionSource,
  DesignIntentRequirement,
  PromptIntent,
  SemanticExpansion,
  TasteTranslation,
} from '../types.js';

function normalizeString(value: string): string {
  return value.trim();
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeString(value);
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function assertSupportedVersions(
  intent: PromptIntent,
  semanticExpansion: SemanticExpansion,
  tasteTranslation: TasteTranslation,
): void {
  if (intent.version !== 1) {
    throw new Error('Design Intent Compiler received an unsupported intent version.');
  }
  if (semanticExpansion.version !== 1) {
    throw new Error('Design Intent Compiler received an unsupported semantic expansion version.');
  }
  if (tasteTranslation.version !== 1) {
    throw new Error('Design Intent Compiler received an unsupported taste translation version.');
  }
}

function compileRequirements(
  intent: PromptIntent,
  semanticExpansion: SemanticExpansion,
): DesignIntentRequirement[] {
  const requirements: DesignIntentRequirement[] = [];
  const seen = new Set<string>();

  const add = (requirement: DesignIntentRequirement): void => {
    const statement = normalizeString(requirement.statement);
    const key = statement.toLocaleLowerCase();
    if (!statement || seen.has(key)) {
      return;
    }
    seen.add(key);
    requirements.push({ ...requirement, statement });
  };

  for (const statement of intent.hardConstraints) {
    add({
      statement,
      source: 'user-constraint',
      kind: 'constraint',
      confidence: 'explicit',
    });
  }

  for (const statement of intent.explicitRequirements) {
    add({
      statement,
      source: 'user-explicit',
      kind: 'requirement',
      confidence: 'explicit',
    });
  }

  for (const item of semanticExpansion.defaults) {
    add({
      statement: item.value,
      source: 'semantic-default',
      kind: item.kind,
      confidence: item.confidence,
      basis: item.basis,
    });
  }

  for (const statement of semanticExpansion.assumptions) {
    add({
      statement,
      source: 'semantic-assumption',
      kind: 'assumption',
      confidence: 'high',
    });
  }

  return requirements;
}

function compileDirectives(tasteTranslation: TasteTranslation): DesignIntentDirective[] {
  return tasteTranslation.decisions.map((decision) => ({
    area: decision.area,
    directive: normalizeString(decision.directive),
    basis: decision.basis,
    intensity: decision.intensity,
    sourceKeywords: dedupeStrings(decision.sourceKeywords),
  }));
}

function compileOpenQuestions(
  intent: PromptIntent,
  semanticExpansion: SemanticExpansion,
  tasteTranslation: TasteTranslation,
): DesignIntentOpenQuestion[] {
  const questions: DesignIntentOpenQuestion[] = [];
  const seen = new Set<string>();

  const add = (value: string, source: DesignIntentOpenQuestionSource): void => {
    const normalized = normalizeString(value);
    const key = normalized.toLocaleLowerCase();
    if (!normalized || seen.has(key)) {
      return;
    }
    seen.add(key);
    questions.push({ value: normalized, source });
  };

  for (const value of intent.missingInformation) {
    add(value, 'missing-information');
  }
  for (const value of semanticExpansion.deferredDecisions) {
    add(value, 'semantic-decision');
  }
  for (const value of tasteTranslation.unresolvedDecisions) {
    add(value, 'taste-decision');
  }

  return questions;
}

export function buildDesignIntent(
  intent: PromptIntent,
  semanticExpansion: SemanticExpansion,
  tasteTranslation: TasteTranslation,
): DesignIntentIR {
  assertSupportedVersions(intent, semanticExpansion, tasteTranslation);

  return {
    version: 1,
    product: {
      type: normalizeString(intent.productType),
      surface: normalizeString(intent.pageType),
      primaryGoal: normalizeString(intent.primaryGoal),
      targetAudience: intent.targetAudience ? normalizeString(intent.targetAudience) : null,
    },
    designDirection: normalizeString(tasteTranslation.designDirection),
    styleSignals: dedupeStrings(intent.styleKeywords),
    requirements: compileRequirements(intent, semanticExpansion),
    directives: compileDirectives(tasteTranslation),
    antiPatterns: dedupeStrings(tasteTranslation.antiPatterns),
    openQuestions: compileOpenQuestions(intent, semanticExpansion, tasteTranslation),
  };
}
