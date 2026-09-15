import { spawn } from 'node:child_process';
import { mkdtemp, realpath, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import {
  currentOperationSignal,
  isOperationCancelled,
  operationCancellationError,
  throwIfOperationCancelled,
} from '../operation-cancellation.js';
import type { Tool, ToolContext, ToolResult } from './tool.js';

export const CHECK_PROJECT_TIMEOUT_MS = 120_000;
export const CHECK_PROJECT_MAX_OUTPUT_BYTES = 64_000;
export const CHECK_PROJECT_MAX_DIAGNOSTICS = 20;

export type ProjectCheckPhase = 'typecheck' | 'build';
export type ProjectCheckStatus = 'PASS' | 'FAIL';

export interface ProjectCheckDiagnostic {
  phase: ProjectCheckPhase;
  message: string;
  code?: string;
  path?: string;
  line?: number;
  column?: number;
}

export interface ProjectCheckStep {
  phase: ProjectCheckPhase;
  status: ProjectCheckStatus;
  exitCode: number | null;
  timedOut: boolean;
  outputTruncated: boolean;
}

export interface CheckProjectOutput {
  status: ProjectCheckStatus;
  checks: ProjectCheckStep[];
  diagnostics: ProjectCheckDiagnostic[];
}

export interface ProjectCheckCommandResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  outputTruncated: boolean;
}

export type ProjectCheckRunner = (
  phase: ProjectCheckPhase,
  projectDirectory: string,
) => Promise<ProjectCheckCommandResult>;

function failure(code: string, message: string): ToolResult<CheckProjectOutput> {
  return { ok: false, error: { code, message } };
}

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, '');
}

function appendBounded(
  current: Buffer,
  chunk: Buffer,
): { value: Buffer; truncated: boolean } {
  const remaining = CHECK_PROJECT_MAX_OUTPUT_BYTES - current.byteLength;
  if (remaining <= 0) return { value: current, truncated: true };
  if (chunk.byteLength <= remaining) {
    return { value: Buffer.concat([current, chunk]), truncated: false };
  }
  return {
    value: Buffer.concat([current, chunk.subarray(0, remaining)]),
    truncated: true,
  };
}

async function runNodeCli(
  scriptPath: string,
  args: string[],
  cwd: string,
): Promise<ProjectCheckCommandResult> {
  const operationSignal = currentOperationSignal();
  throwIfOperationCancelled(operationSignal);

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      env: { ...process.env, NODE_ENV: 'production' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let outputTruncated = false;
    let timedOut = false;
    let settled = false;

    child.stdout.on('data', (chunk: Buffer) => {
      const next = appendBounded(stdout, chunk);
      stdout = next.value;
      outputTruncated ||= next.truncated;
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const next = appendBounded(stderr, chunk);
      stderr = next.value;
      outputTruncated ||= next.truncated;
    });

    const onAbort = () => {
      child.kill();
    };
    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, CHECK_PROJECT_TIMEOUT_MS);
    const cleanup = () => {
      clearTimeout(timeout);
      operationSignal?.removeEventListener('abort', onAbort);
    };
    const settle = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    if (operationSignal?.aborted) onAbort();
    else operationSignal?.addEventListener('abort', onAbort, { once: true });

    child.once('error', (error) => {
      settle(() => {
        if (operationSignal?.aborted) {
          reject(operationCancellationError(operationSignal.reason));
          return;
        }
        reject(error);
      });
    });
    child.once('close', (exitCode) => {
      settle(() => {
        if (operationSignal?.aborted) {
          reject(operationCancellationError(operationSignal.reason));
          return;
        }
        resolve({
          exitCode,
          stdout: stdout.toString('utf8'),
          stderr: stderr.toString('utf8'),
          timedOut,
          outputTruncated,
        });
      });
    });
  });
}

async function assertFile(filePath: string, label: string): Promise<void> {
  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) throw new Error(`Project check requires ${label}: ${filePath}`);
}

export const defaultProjectCheckRunner: ProjectCheckRunner = async (
  phase,
  projectDirectory,
) => {
  throwIfOperationCancelled();
  const toolchainRoot = process.cwd();

  if (phase === 'typecheck') {
    const tscScript = path.join(toolchainRoot, 'node_modules', 'typescript', 'bin', 'tsc');
    await assertFile(tscScript, 'the Yakable TypeScript toolchain');
    throwIfOperationCancelled();
    return runNodeCli(
      tscScript,
      ['--noEmit', '-p', path.join(projectDirectory, 'tsconfig.json')],
      projectDirectory,
    );
  }

  const viteScript = path.join(toolchainRoot, 'node_modules', 'vite', 'bin', 'vite.js');
  await assertFile(viteScript, 'the Yakable Vite toolchain');
  throwIfOperationCancelled();
  const outputDirectory = await mkdtemp(path.join(os.tmpdir(), 'yakable-check-build-'));
  try {
    return await runNodeCli(
      viteScript,
      ['build', projectDirectory, '--outDir', outputDirectory],
      projectDirectory,
    );
  } finally {
    await rm(outputDirectory, { recursive: true, force: true });
  }
};

function normalizeDiagnosticPath(projectDirectory: string, candidate: string): string | undefined {
  const cleaned = candidate.trim().replace(/^file:\s*/i, '');
  if (!cleaned) return undefined;
  const absolute = path.isAbsolute(cleaned) ? cleaned : path.resolve(projectDirectory, cleaned);
  const relative = path.relative(projectDirectory, absolute);
  if (!relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    return undefined;
  }
  return relative.split(path.sep).join('/');
}

function boundedMessage(value: string): string {
  return value.trim().slice(0, 1_000);
}

export function parseProjectCheckDiagnostics(
  phase: ProjectCheckPhase,
  rawOutput: string,
  projectDirectory: string,
): ProjectCheckDiagnostic[] {
  const lines = stripAnsi(rawOutput)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const diagnostics: ProjectCheckDiagnostic[] = [];

  for (const line of lines) {
    const typeScript = line.match(/^(.+?)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/);
    if (typeScript) {
      const normalizedPath = normalizeDiagnosticPath(projectDirectory, typeScript[1]!);
      diagnostics.push({
        phase,
        ...(normalizedPath ? { path: normalizedPath } : {}),
        line: Number(typeScript[2]),
        column: Number(typeScript[3]),
        code: typeScript[4],
        message: boundedMessage(typeScript[5]!),
      });
    } else {
      const located = line.match(/^(.+?\.(?:ts|tsx|js|jsx|css|html)):(\d+):(\d+)\s*(.*)$/i);
      if (located) {
        const normalizedPath = normalizeDiagnosticPath(projectDirectory, located[1]!);
        diagnostics.push({
          phase,
          ...(normalizedPath ? { path: normalizedPath } : {}),
          line: Number(located[2]),
          column: Number(located[3]),
          message: boundedMessage(located[4] || line),
        });
      } else if (/error|failed|cannot find|could not resolve|transform failed|rolluperror/i.test(line)) {
        diagnostics.push({ phase, message: boundedMessage(line) });
      }
    }
    if (diagnostics.length >= CHECK_PROJECT_MAX_DIAGNOSTICS) break;
  }

  if (diagnostics.length === 0) {
    for (const line of lines.slice(-8)) {
      diagnostics.push({ phase, message: boundedMessage(line) });
      if (diagnostics.length >= CHECK_PROJECT_MAX_DIAGNOSTICS) break;
    }
  }
  return diagnostics;
}

function stepFromResult(
  phase: ProjectCheckPhase,
  result: ProjectCheckCommandResult,
): ProjectCheckStep {
  return {
    phase,
    status: result.exitCode === 0 && !result.timedOut ? 'PASS' : 'FAIL',
    exitCode: result.exitCode,
    timedOut: result.timedOut,
    outputTruncated: result.outputTruncated,
  };
}

export async function checkProjectDirectory(
  projectDirectory: string,
  runner: ProjectCheckRunner = defaultProjectCheckRunner,
): Promise<ToolResult<CheckProjectOutput>> {
  throwIfOperationCancelled();
  const projectRoot = await realpath(projectDirectory).catch(() => null);
  throwIfOperationCancelled();
  if (!projectRoot) return failure('PROJECT_NOT_FOUND', `Project directory does not exist: ${projectDirectory}`);

  try {
    await assertFile(path.join(projectRoot, 'tsconfig.json'), 'tsconfig.json');
    await assertFile(path.join(projectRoot, 'index.html'), 'index.html');
    throwIfOperationCancelled();
  } catch (error) {
    if (isOperationCancelled(error)) throw error;
    return failure('INVALID_PROJECT', error instanceof Error ? error.message : String(error));
  }

  const checks: ProjectCheckStep[] = [];
  let typecheck: ProjectCheckCommandResult;
  try {
    typecheck = await runner('typecheck', projectRoot);
  } catch (error) {
    if (isOperationCancelled(error)) throw error;
    return failure(
      'CHECK_EXECUTION_FAILED',
      `Project typecheck could not run: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  throwIfOperationCancelled();
  checks.push(stepFromResult('typecheck', typecheck));

  if (checks[0]!.status === 'FAIL') {
    return {
      ok: true,
      value: {
        status: 'FAIL',
        checks,
        diagnostics: parseProjectCheckDiagnostics(
          'typecheck',
          `${typecheck.stdout}\n${typecheck.stderr}`,
          projectRoot,
        ),
      },
    };
  }

  let build: ProjectCheckCommandResult;
  try {
    build = await runner('build', projectRoot);
  } catch (error) {
    if (isOperationCancelled(error)) throw error;
    return failure(
      'CHECK_EXECUTION_FAILED',
      `Project build check could not run: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  throwIfOperationCancelled();
  checks.push(stepFromResult('build', build));

  if (checks[1]!.status === 'FAIL') {
    return {
      ok: true,
      value: {
        status: 'FAIL',
        checks,
        diagnostics: parseProjectCheckDiagnostics(
          'build',
          `${build.stdout}\n${build.stderr}`,
          projectRoot,
        ),
      },
    };
  }

  return {
    ok: true,
    value: { status: 'PASS', checks, diagnostics: [] },
  };
}

function commandLabel(phase: ProjectCheckPhase): string {
  return phase === 'typecheck' ? 'tsc --noEmit -p tsconfig.json' : 'vite build';
}

function emitStructuredCheckItems(
  context: ToolContext,
  result: ToolResult<CheckProjectOutput>,
): void {
  const agent = context.agent;
  if (!agent) return;

  if (!result.ok) {
    agent.checkResult({
      result: 'ERROR',
      checks: [],
      diagnosticCount: 0,
      message: result.error.message,
    });
    return;
  }

  for (const check of result.value.checks) {
    agent.commandExecution({
      command: commandLabel(check.phase),
      phase: check.phase,
      status: check.status === 'PASS' ? 'COMPLETED' : 'FAILED',
      message: `${check.phase} ${check.status.toLowerCase()}`,
      exitCode: check.exitCode,
      timedOut: check.timedOut,
      outputTruncated: check.outputTruncated,
    });
  }
  agent.checkResult({
    result: result.value.status,
    checks: result.value.checks,
    diagnosticCount: result.value.diagnostics.length,
    message: result.value.status === 'PASS'
      ? 'Project health checks passed'
      : `Project health checks failed with ${result.value.diagnostics.length} diagnostic(s)`,
  });
}

export const checkProjectTool: Tool<unknown, CheckProjectOutput> = {
  name: 'check_project',
  description: 'Run bounded TypeScript and Vite build health checks for the current frontend project.',

  async execute(input: unknown, context: ToolContext): Promise<ToolResult<CheckProjectOutput>> {
    throwIfOperationCancelled();
    if (input !== undefined && (typeof input !== 'object' || input === null || Array.isArray(input))) {
      return failure('INVALID_INPUT', 'check_project accepts an empty object input.');
    }

    const toolCall = context.agent?.startToolCall(
      'check_project',
      'Running project health checks',
      'TypeScript typecheck and Vite production build',
    );
    const result = await checkProjectDirectory(context.projectDirectory);
    throwIfOperationCancelled();
    emitStructuredCheckItems(context, result);
    if (toolCall) {
      context.agent!.completeToolCall(
        toolCall.id,
        result.ok && result.value.status === 'PASS' ? 'COMPLETED' : 'FAILED',
        result.ok
          ? `Project health check ${result.value.status.toLowerCase()}`
          : result.error.message,
        result.ok
          ? `${result.value.checks.length} command(s), ${result.value.diagnostics.length} diagnostic(s)`
          : result.error.code,
      );
    }
    return result;
  },
};
