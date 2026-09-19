import type { ModelOption, ModelSelection } from './types';

export const MODEL_CATALOG = [
  {
    provider: 'deepseek',
    model: 'deepseek-flash',
    label: 'DeepSeek',
  },
  {
    provider: 'kimi',
    model: 'kimi-k3',
    label: 'Kimi',
  },
] as const satisfies readonly ModelOption[];

export const DEFAULT_MODEL_SELECTION: ModelSelection = {
  provider: MODEL_CATALOG[0].provider,
  model: MODEL_CATALOG[0].model,
};
