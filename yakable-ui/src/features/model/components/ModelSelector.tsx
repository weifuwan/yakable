import { useMemo } from 'react';

import { Select } from '@/shared/ui';

import { MODEL_CATALOG } from '../catalog';
import type { ModelOption, ModelSelection } from '../types';

function modelValue(model: ModelSelection): string {
  return `${encodeURIComponent(model.provider)}:${encodeURIComponent(model.model)}`;
}

export function ModelSelector({
  disabled = false,
  models = MODEL_CATALOG,
  onValueChange,
  value,
}: {
  disabled?: boolean;
  models?: readonly ModelOption[];
  onValueChange: (value: ModelSelection) => void;
  value: ModelSelection;
}) {
  const options = useMemo(
    () =>
      models.map((model) => ({
        value: modelValue(model),
        label: model.label,
      })),
    [models],
  );

  return (
    <Select
      aria-label="Select model"
      disabled={disabled}
      value={modelValue(value)}
      options={options}
      align="end"
      size="sm"
      className="max-w-40"
      onValueChange={(nextValue) => {
        const selected = models.find(
          (model) => modelValue(model) === nextValue,
        );

        if (!selected) return;

        onValueChange({
          provider: selected.provider,
          model: selected.model,
        });
      }}
    />
  );
}
