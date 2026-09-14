export const YAKABLE_MODES = ['PLAN', 'BUILD'] as const;

export type YakableMode = (typeof YAKABLE_MODES)[number];

export const YAKABLE_MODE_CAPABILITIES = [
  'read-project',
  'search-project',
  'observe-preview',
  'critique-design',
  'read-plan',
  'write-plan',
  'review-plan',
  'plan-ui',
  'execute-plan',
  'generate-source',
  'edit-source',
  'repair-source',
] as const;

export type YakableModeCapability = (typeof YAKABLE_MODE_CAPABILITIES)[number];

const PLAN_CAPABILITIES = new Set<YakableModeCapability>([
  'read-project',
  'search-project',
  'observe-preview',
  'critique-design',
  'read-plan',
  'write-plan',
  'review-plan',
  'plan-ui',
]);

const BUILD_CAPABILITIES = new Set<YakableModeCapability>([
  'read-project',
  'search-project',
  'observe-preview',
  'critique-design',
  'read-plan',
  'execute-plan',
  'generate-source',
  'edit-source',
  'repair-source',
]);

const MODE_POLICY: Record<YakableMode, ReadonlySet<YakableModeCapability>> = {
  PLAN: PLAN_CAPABILITIES,
  BUILD: BUILD_CAPABILITIES,
};

export class ModeCapabilityError extends Error {
  readonly code = 'MODE_CAPABILITY_FORBIDDEN';
  readonly mode: YakableMode;
  readonly capability: YakableModeCapability;

  constructor(mode: YakableMode, capability: YakableModeCapability) {
    super(`${mode} mode does not allow ${capability}.`);
    this.name = 'ModeCapabilityError';
    this.mode = mode;
    this.capability = capability;
  }
}

export interface YakableModeContext {
  mode: YakableMode;
  capabilities: YakableModeCapability[];
  allows(capability: YakableModeCapability): boolean;
  assert(capability: YakableModeCapability): void;
}

export function parseYakableMode(
  value: unknown,
  fallback: YakableMode = 'BUILD',
): YakableMode {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') {
    throw new Error('Yakable mode must be PLAN or BUILD.');
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === 'PLAN' || normalized === 'BUILD') return normalized;
  throw new Error('Yakable mode must be PLAN or BUILD.');
}

export function capabilitiesForMode(mode: YakableMode): YakableModeCapability[] {
  return YAKABLE_MODE_CAPABILITIES.filter((capability) => MODE_POLICY[mode].has(capability));
}

export function modeAllowsCapability(
  mode: YakableMode,
  capability: YakableModeCapability,
): boolean {
  return MODE_POLICY[mode].has(capability);
}

export function assertModeCapability(
  mode: YakableMode,
  capability: YakableModeCapability,
): void {
  if (!modeAllowsCapability(mode, capability)) {
    throw new ModeCapabilityError(mode, capability);
  }
}

export function createYakableModeContext(mode: YakableMode = 'BUILD'): YakableModeContext {
  return {
    mode,
    capabilities: capabilitiesForMode(mode),
    allows: (capability) => modeAllowsCapability(mode, capability),
    assert: (capability) => assertModeCapability(mode, capability),
  };
}
