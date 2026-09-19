import { useEffect, useState } from 'react';

import { isAbortError } from '@/shared/api';

import { ensureGenerationRun } from '../api/generation-api';
import type {
  GenerationRun,
  GenerationStepKey,
  GenerationStepStatus,
} from '../types';

const STEP_LABELS: Record<GenerationStepKey, string> = {
  PREPARING: 'Preparing project',
  PLANNING: 'Planning changes',
  GENERATING: 'Generating files',
  APPLYING: 'Applying changes',
};

const STATUS_LABELS: Record<GenerationStepStatus, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  SUCCEEDED: 'Done',
  FAILED: 'Failed',
};

function StepIndicator({ status }: { status: GenerationStepStatus }) {
  if (status === 'SUCCEEDED') {
    return (
      <span
        aria-hidden="true"
        className="flex size-5 items-center justify-center rounded-full bg-[#20201e] text-[10px] text-white"
      >
        ✓
      </span>
    );
  }

  if (status === 'FAILED') {
    return (
      <span
        aria-hidden="true"
        className="flex size-5 items-center justify-center rounded-full border border-red-300 text-[11px] text-red-600"
      >
        !
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={
        status === 'RUNNING'
          ? 'size-2.5 rounded-full bg-[#20201e]'
          : 'size-2.5 rounded-full border border-black/20'
      }
    />
  );
}

export function GenerationWorkspace({
  model,
  projectId,
  projectName,
  prompt,
  provider,
}: {
  model: string;
  projectId: string;
  projectName: string;
  prompt: string;
  provider: string;
}) {
  const [run, setRun] = useState<GenerationRun | null>(null);
  const [isStarting, setIsStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    setIsStarting(true);
    setError(null);

    void ensureGenerationRun(projectId, controller.signal)
      .then((result) => {
        setRun(result);
        setError(null);
      })
      .catch((requestError: unknown) => {
        if (isAbortError(requestError, controller.signal)) return;

        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unable to start generation.',
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsStarting(false);
      });

    return () => {
      controller.abort();
    };
  }, [projectId]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f7f5]">
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-black/[0.08] bg-white px-5">
        <div className="min-w-0">
          <h1 className="m-0 truncate text-sm font-semibold">{projectName}</h1>
          <p className="m-0 mt-0.5 truncate text-xs text-black/40">
            {provider} / {model}
          </p>
        </div>

        {run && (
          <span className="shrink-0 text-xs text-black/35">
            Run {run.id.slice(0, 8)}
          </span>
        )}
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(320px,42%)_minmax(0,1fr)]">
        <section className="min-w-0 overflow-y-auto border-r border-black/[0.08] bg-white px-5 py-6">
          <div className="mx-auto max-w-2xl">
            <div className="flex justify-end">
              <div className="max-w-[88%] rounded-2xl rounded-br-md bg-black/[0.06] px-4 py-3">
                <p className="m-0 whitespace-pre-wrap text-sm leading-6 text-[#20201e]">
                  {prompt}
                </p>
              </div>
            </div>

            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="m-0 text-sm font-semibold">Generation</h2>
                {isStarting && (
                  <span className="text-xs text-black/40">Starting...</span>
                )}
                {!isStarting && run && (
                  <span className="text-xs font-medium text-black/45">
                    {run.status === 'RUNNING' ? 'Running' : run.status}
                  </span>
                )}
              </div>

              {error && (
                <div
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                  role="alert"
                >
                  {error}
                </div>
              )}

              {run && (
                <ol className="m-0 flex list-none flex-col gap-1 p-0">
                  {run.steps.map((step) => (
                    <li
                      key={step.key}
                      className="flex min-h-11 items-center gap-3 rounded-xl px-3"
                    >
                      <div className="flex size-5 shrink-0 items-center justify-center">
                        <StepIndicator status={step.status} />
                      </div>
                      <span className="min-w-0 flex-1 text-sm text-black/65">
                        {STEP_LABELS[step.key]}
                      </span>
                      <span className="shrink-0 text-xs text-black/35">
                        {STATUS_LABELS[step.status]}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </section>

        <section className="flex min-h-[420px] min-w-0 flex-col bg-[#f7f7f5]">
          <div className="flex h-11 shrink-0 items-center border-b border-black/[0.07] px-4">
            <h2 className="m-0 text-xs font-semibold text-black/55">Preview</h2>
          </div>

          <div className="flex flex-1 items-center justify-center px-6 py-12">
            <div className="max-w-sm text-center">
              <div className="mx-auto flex size-10 items-center justify-center rounded-xl border border-black/[0.08] bg-white text-lg text-black/35">
                ◇
              </div>
              <h3 className="mb-0 mt-4 text-sm font-semibold text-black/60">
                Waiting for generated files
              </h3>
              <p className="mb-0 mt-2 text-sm leading-6 text-black/40">
                The generation run has started. Preview will appear here after
                real output files exist.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
