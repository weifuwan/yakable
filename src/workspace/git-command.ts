import { spawn } from 'node:child_process';

const DEFAULT_MAX_GIT_OUTPUT_BYTES = 4_000_000;

export interface GitCommandOptions {
  acceptExitCodes?: number[];
  maxOutputBytes?: number;
}

export interface GitCommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function appendBounded(
  current: Buffer,
  chunk: Buffer,
  maxBytes: number,
): { value: Buffer; overflow: boolean } {
  const remaining = maxBytes - current.byteLength;
  if (remaining <= 0) return { value: current, overflow: true };
  if (chunk.byteLength <= remaining) {
    return { value: Buffer.concat([current, chunk]), overflow: false };
  }
  return {
    value: Buffer.concat([current, chunk.subarray(0, remaining)]),
    overflow: true,
  };
}

export async function runGitCommand(
  cwd: string,
  args: string[],
  options: GitCommandOptions = {},
): Promise<GitCommandResult> {
  const accepted = new Set(options.acceptExitCodes ?? [0]);
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_GIT_OUTPUT_BYTES;

  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0',
        LC_ALL: 'C',
      },
    });

    let stdout = Buffer.alloc(0);
    let stderr = Buffer.alloc(0);
    let overflow = false;

    child.stdout.on('data', (chunk: Buffer) => {
      const next = appendBounded(stdout, chunk, maxOutputBytes);
      stdout = next.value;
      overflow ||= next.overflow;
      if (overflow) child.kill();
    });

    child.stderr.on('data', (chunk: Buffer) => {
      const next = appendBounded(stderr, chunk, maxOutputBytes);
      stderr = next.value;
      overflow ||= next.overflow;
      if (overflow) child.kill();
    });

    child.once('error', (error) => reject(error));
    child.once('close', (exitCode) => {
      if (overflow) {
        reject(new Error(`Git output exceeded ${maxOutputBytes} bytes.`));
        return;
      }

      const code = exitCode ?? -1;
      const result = {
        stdout: stdout.toString('utf8'),
        stderr: stderr.toString('utf8'),
        exitCode: code,
      };
      if (accepted.has(code)) {
        resolve(result);
        return;
      }

      const detail = result.stderr.trim() || result.stdout.trim() || `exit code ${code}`;
      reject(new Error(`Git command failed: git ${args.join(' ')}: ${detail}`));
    });
  });
}
