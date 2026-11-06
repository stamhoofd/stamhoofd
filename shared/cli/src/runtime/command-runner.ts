import { formatCommandLine, processError } from '@node/opentelemetry-process';
import { command as formatCommand, warning } from './ux.js';
import { writeOutputLine } from './output-target.js';
import { RunVerbosity } from './verbosity.js';
import { execResult } from './process.js';

export { RunVerbosity };

export type RunOptions = {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    verbosity?: RunVerbosity;
    allowFailure?: boolean;
    /** Return stdout and stderr instead of forwarding or suppressing them. */
    capture?: boolean;
    /** Set false for sudo probes that must share the caller's terminal credential cache. */
    processGroup?: boolean;
};

export type RunCaptureResult = { stdout: string; stderr: string; status: number | null };

/** Compatibility adapter: preserves merged environments and the legacy capture result shape. */
export async function run(command: string, args: string[], options: RunOptions & { capture: true }): Promise<RunCaptureResult>;
export async function run(command: string, args: string[], options?: RunOptions): Promise<void>;
export async function run(command: string, args: string[], options: RunOptions = {}): Promise<void | RunCaptureResult> {
    const verbosity = options.verbosity ?? RunVerbosity.Command;
    try {
        const result = await execResult(command, args, {
            cwd: options.cwd,
            env: { ...process.env, ...options.env },
            capture: options.capture,
            processGroup: options.processGroup,
            inheritStdin: !options.capture && verbosity === RunVerbosity.Output,
            output: verbosity === RunVerbosity.Output ? 'always' : 'verbose',
            label: verbosity === RunVerbosity.Quiet ? false : undefined,
            // Quiet probes must remain silent even in a verbose invocation.
            log: verbosity === RunVerbosity.Quiet ? () => false : undefined,
        });
        if (result.code !== 0 && !options.allowFailure) throw processError(`${command} failed.`, command, result);
        if (options.capture) return { stdout: result.stdout, stderr: result.stderr === '(no stderr returned)' ? '' : result.stderr, status: result.code };
    } catch (error) {
        if (!options.allowFailure) throw error;
        if (options.capture) return { stdout: '', stderr: error instanceof Error ? error.message : String(error), status: 1 };
    }
}

export function printCommand(command: string, args: string[]): void {
    writeOutputLine(formatCommand(`  ${formatCommandLine(command, args)}`));
}

export function printFailureSuggestion(error: unknown): void {
    if (!(error instanceof Error)) return;
    if (error.message.includes('docker') || error.message.includes('podman')) {
        warning('Podman or Docker is not reachable. Start a container runtime and retry: stam setup');
    }
    if (error.message.includes('caddy')) {
        warning('Caddy failed. Check Caddy installation and retry: stam setup cert');
    }
}
