import { spawn } from 'node:child_process';
import { command as formatCommand, warning } from './ux.js';
import { writeOutputLine } from './output-target.js';

export type RunOptions = {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    quiet?: boolean;
    allowFailure?: boolean;
    verbose?: boolean;
    capture?: boolean;
};

export type RunCaptureResult = { stdout: string; stderr: string; status: number | null };

export async function run(command: string, args: string[], options: RunOptions & { capture: true }): Promise<RunCaptureResult>;
export async function run(command: string, args: string[], options?: RunOptions): Promise<void>;
export async function run(command: string, args: string[], options: RunOptions = {}): Promise<void | RunCaptureResult> {
    if (options.verbose) {
        printCommand(command, args);
    }

    if (options.capture) {
        return await new Promise<RunCaptureResult>((resolve, reject) => {
            const child = spawn(command, args, {
                cwd: options.cwd,
                env: { ...process.env, ...options.env },
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            child.stdout.on('data', chunk => stdout += String(chunk));
            child.stderr.on('data', chunk => stderr += String(chunk));
            child.on('error', (error) => {
                if (options.allowFailure) {
                    resolve({ stdout, stderr: String(error), status: 1 });
                    return;
                }
                reject(error);
            });
            child.on('exit', (status) => {
                if (status === 0 || options.allowFailure) {
                    resolve({ stdout, stderr, status });
                    return;
                }
                reject(new Error(`${formatCommandLine(command, args)} exited with status ${status}: ${stderr}`));
            });
        });
    }

    await new Promise<void>((resolve, reject) => {
        const child = spawn(command, args, {
            cwd: options.cwd,
            env: { ...process.env, ...options.env },
            stdio: options.quiet ? ['ignore', 'ignore', 'pipe'] : 'inherit',
        });
        let stderr = '';

        if (options.quiet && child.stderr) {
            child.stderr.on('data', chunk => stderr += String(chunk));
        }

        child.on('error', reject);
        child.on('exit', (code) => {
            if (code === 0 || options.allowFailure) {
                resolve();
                return;
            }
            reject(new Error(`${formatCommandLine(command, args)} exited with status ${code}${stderr ? `: ${stderr.trim()}` : ''}`));
        });
    });
}

export function printCommand(command: string, args: string[]): void {
    writeOutputLine(formatCommand(`  ${formatCommandLine(command, args)}`));
}

export function printFailureSuggestion(error: unknown): void {
    if (!(error instanceof Error)) {
        return;
    }
    if (error.message.includes('docker') || error.message.includes('podman')) {
        warning('Podman or Docker is not reachable. Start a container runtime and retry: stam setup');
    }
    if (error.message.includes('caddy')) {
        warning('Caddy failed. Check Caddy installation and retry: stam setup cert');
    }
}

function formatCommandLine(command: string, args: string[]): string {
    return [command, ...args].map(quoteArgument).join(' ');
}

function quoteArgument(argument: string): string {
    return /^[\w./:=@+-]+$/.test(argument) ? argument : JSON.stringify(argument);
}
