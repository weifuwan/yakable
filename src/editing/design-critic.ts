import { requestDesignCritique } from '../model/deepseek.js';
import type { DesignIntentIR } from '../types.js';
import type { PageObservation } from '../runtime/page-observation.js';
import type { EditIntentArea, EditIntentDelta } from './edit-intent.js';

export const DESIGN_CRITIC_VERSION = 1 as const;
export const DESIGN_CRITIC_MAX_FINDINGS = 8;
export const DESIGN_CRITIC_MAX_EVIDENCE_REFS = 4;
export const DESIGN_CRITIC_MAX_UNVERIFIED_AREAS = 12;
export const DESIGN_CRITIC_MAX_REQUEST_CHARS = 160_000;
const DESIGN_CRITIC_MAX_SUMMARY_LENGTH = 500;
const DESIGN_CRITIC_MAX_FINDING_LENGTH = 500;

export type DesignCriticStatus = 'PASS' | 'FAIL';
export type DesignCriticSeverity = 'major' | 'minor';
export type DesignCriticArea = EditIntentArea | 'runtime';

export interface DesignCriticFinding {
  area: DesignCriticArea;
  severity: DesignCriticSeverity;
  message: string;
  evidenceRefs: string[];
}

export interface DesignCriticResult {
  version: 1;
  status: DesignCriticStatus;
  summary: string;
  findings: DesignCriticFinding[];
  unverifiedAreas: EditIntentArea[];
}

export interface DesignCriticInput {
  baselineDesignIntent: DesignIntentIR | null;
  editIntent: EditIntentDelta;
  pageObservation: PageObservation;
}

export interface DesignCriticRun {
  model: string;
  result: DesignCriticResult;
}

const AREAS = new Set<DesignCriticArea>([
  'content',
  'visual-hierarchy',
  'composition',
  'typography',
  'color',
  'spacing-density',
  'surface-treatment',
  'imagery',
  'motion',
  'interaction',
  'responsive',
  'navigation',
  'component-expression',
  'runtime',
]);

const FRONTEND_AREAS = new Set<EditIntentArea>([
  'content',
  'visual-hierarchy',
  'composition',
  'typography',
  'color',
  'spacing-density',
  'surface-treatment',
  'imagery',
  'motion',
  'interaction',
  'responsive',
  'navigation',
  'component-expression',
]);

const SEVERITIES = new Set<DesignCriticSeverity>(['major', 'minor']);
const STATUSES = new Set<DesignCriticStatus>(['PASS', 'FAIL']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readEnum<T extends string>(value: unknown, field: string, allowed: Set<T>): T {
  if (typeof value !== 'string' || !allowed.has(value as T)) {
    throw new Error(`Design Critic returned an invalid ${field}.`);
  }
  return value as T;
}

function readString(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') {
    throw new Error(`Design Critic returned an invalid ${field}.`);
  }
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new Error(`Design Critic returned an invalid ${field}.`);
  }
  return normalized;
}

function evidenceCatalog(observation: PageObservation): Set<string> {
  const refs = new Set<string>(['page']);
  observation.elements.forEach((_element, index) => refs.add(`element:${index}`));
  observation.runtimeErrors.forEach((_error, index) => refs.add(`runtime:${index}`));
  return refs;
}

function readEvidenceRefs(value: unknown, allowed: Set<string>): string[] {
  if (
    !Array.isArray(value)
    || value.length === 0
    || value.length > DESIGN_CRITIC_MAX_EVIDENCE_REFS
  ) {
    throw new Error(
      `Design Critic evidenceRefs must contain 1-${DESIGN_CRITIC_MAX_EVIDENCE_REFS} items.`,
    );
  }

  const refs: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new Error('Design Critic evidenceRefs must contain strings only.');
    }
    const ref = item.trim();
    if (!allowed.has(ref)) {
      throw new Error(`Design Critic referenced unavailable evidence: ${ref || '<empty>'}.`);
    }
    if (!refs.includes(ref)) refs.push(ref);
  }
  if (refs.length === 0) {
    throw new Error('Design Critic finding must contain at least one evidence reference.');
  }
  return refs;
}

function readFindings(value: unknown, observation: PageObservation): DesignCriticFinding[] {
  if (!Array.isArray(value) || value.length > DESIGN_CRITIC_MAX_FINDINGS) {
    throw new Error(`Design Critic may return at most ${DESIGN_CRITIC_MAX_FINDINGS} findings.`);
  }

  const allowedEvidence = evidenceCatalog(observation);
  const findings: DesignCriticFinding[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (!isRecord(item)) {
      throw new Error('Design Critic returned an invalid finding.');
    }
    const area = readEnum(item.area, 'finding area', AREAS);
    const severity = readEnum(item.severity, 'finding severity', SEVERITIES);
    const message = readString(item.message, 'finding message', DESIGN_CRITIC_MAX_FINDING_LENGTH);
    const evidenceRefs = readEvidenceRefs(item.evidenceRefs, allowedEvidence);
    const key = `${area}:${severity}:${message.toLocaleLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    findings.push({ area, severity, message, evidenceRefs });
  }

  return findings;
}

function readUnverifiedAreas(value: unknown): EditIntentArea[] {
  if (!Array.isArray(value) || value.length > DESIGN_CRITIC_MAX_UNVERIFIED_AREAS) {
    throw new Error(
      `Design Critic may return at most ${DESIGN_CRITIC_MAX_UNVERIFIED_AREAS} unverified areas.`,
    );
  }

  const areas: EditIntentArea[] = [];
  for (const item of value) {
    const area = readEnum(item, 'unverified area', FRONTEND_AREAS);
    if (!areas.includes(area)) areas.push(area);
  }
  return areas;
}

export function parseDesignCriticResult(
  rawContent: string,
  observation: PageObservation,
): DesignCriticResult {
  let value: unknown;
  try {
    value = JSON.parse(rawContent);
  } catch {
    throw new Error('Design Critic output was not valid JSON.');
  }

  if (!isRecord(value) || value.version !== DESIGN_CRITIC_VERSION) {
    throw new Error('Design Critic output must be a version 1 object.');
  }

  const status = readEnum(value.status, 'status', STATUSES);
  const findings = readFindings(value.findings, observation);

  if (status === 'PASS' && findings.length > 0) {
    throw new Error('Design Critic PASS cannot contain findings.');
  }
  if (status === 'FAIL' && findings.length === 0) {
    throw new Error('Design Critic FAIL must contain at least one finding.');
  }

  return {
    version: DESIGN_CRITIC_VERSION,
    status,
    summary: readString(value.summary, 'summary', DESIGN_CRITIC_MAX_SUMMARY_LENGTH),
    findings,
    unverifiedAreas: readUnverifiedAreas(value.unverifiedAreas),
  };
}

function observationWithEvidenceRefs(observation: PageObservation) {
  return {
    ...observation,
    evidenceRef: 'page',
    elements: observation.elements.map((element, index) => ({
      evidenceRef: `element:${index}`,
      ...element,
    })),
    runtimeErrors: observation.runtimeErrors.map((error, index) => ({
      evidenceRef: `runtime:${index}`,
      ...error,
    })),
  };
}

export function buildDesignCriticRequest(input: DesignCriticInput): string {
  const request = JSON.stringify({
    baselineDesignIntent: input.baselineDesignIntent,
    editIntent: input.editIntent,
    pageObservation: observationWithEvidenceRefs(input.pageObservation),
  });

  if (request.length > DESIGN_CRITIC_MAX_REQUEST_CHARS) {
    throw new Error(
      `Design Critic request is too large (max ${DESIGN_CRITIC_MAX_REQUEST_CHARS} characters).`,
    );
  }
  return request;
}

function runtimeFinding(error: PageObservation['runtimeErrors'][number], index: number): DesignCriticFinding {
  return {
    area: 'runtime',
    severity: 'major',
    message: `Runtime ${error.kind}: ${error.message}`.slice(0, DESIGN_CRITIC_MAX_FINDING_LENGTH),
    evidenceRefs: [`runtime:${index}`],
  };
}

export function mergeDeterministicRuntimeFindings(
  result: DesignCriticResult,
  observation: PageObservation,
): DesignCriticResult {
  if (observation.runtimeErrors.length === 0) return result;

  const coveredRuntimeRefs = new Set(
    result.findings.flatMap((finding) =>
      finding.evidenceRefs.filter((ref) => ref.startsWith('runtime:')),
    ),
  );
  const findings = [...result.findings];

  observation.runtimeErrors.forEach((error, index) => {
    const ref = `runtime:${index}`;
    if (coveredRuntimeRefs.has(ref) || findings.length >= DESIGN_CRITIC_MAX_FINDINGS) return;
    findings.push(runtimeFinding(error, index));
  });

  return {
    ...result,
    status: 'FAIL',
    summary:
      result.status === 'PASS'
        ? 'Runtime errors were observed in the current Preview.'
        : result.summary,
    findings,
  };
}

export async function critiqueDesign(input: DesignCriticInput): Promise<DesignCriticRun> {
  const generation = await requestDesignCritique(buildDesignCriticRequest(input));
  const parsed = parseDesignCriticResult(generation.content, input.pageObservation);
  return {
    model: generation.model,
    result: mergeDeterministicRuntimeFindings(parsed, input.pageObservation),
  };
}
