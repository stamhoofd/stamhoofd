import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';

const appNames = new Map([
    ['@stamhoofd/backend#dev', 'api'], ['@stamhoofd/backend-renderer#dev', 'renderer'],
    ['@stamhoofd/backend-statistics-syncer#dev', 'stats'], ['@stamhoofd/web-app#dev', 'dashboard'],
    ['@stamhoofd/webshop#dev', 'webshop'],
]);

/**
 * Presents one Turbo NDJSON record without inspecting rendered message text.
 * @param line - Complete stdout line, excluding its delimiter.
 * @param write - Output destination.
 * @remarks Only Turbo-owned info records are hidden. Task output, unknown records
 * and malformed frames remain visible; stderr retains its original stream.
 */
export function forwardTurboLine(line: string, write: (stream: 'stdout' | 'stderr', text: string) => void) {
    let value: unknown;
    try {
        value = JSON.parse(line);
    } catch {
        write('stdout', line + '\n');
        return;
    }
    const record = value && typeof value === 'object' ? value as Record<string, unknown> : undefined;
    if (!record || typeof record.source !== 'string' || typeof record.text !== 'string'
        || typeof record.level !== 'string' || !['info', 'warn', 'error', 'stdout', 'stderr'].includes(record.level)) {
        write('stdout', line + '\n');
        return;
    }
    if (record.source === 'turbo' && record.level === 'info') return;
    const stream = ['stderr', 'warn', 'error'].includes(record.level) ? 'stderr' : 'stdout';
    const app = appNames.get(record.source);
    const prefix = app ? `[${app}]` : `${record.source.replace('#', ':')}:`;
    write(stream, `${prefix} ${record.text}\n`);
}

/**
 * Runs a pnpm command ending in Turbo, retaining Turbo's graph and exit status.
 * @param args - pnpm arguments; Turbo flags are appended to these.
 * @param options - Buffer finite shared builds in normal mode.
 * @returns Exit code, or 1 for spawn failure/signal termination.
 * @remarks Normal managed sessions consume Turbo's documented NDJSON interface.
 * Verbose/unmanaged sessions inherit native output. Signals are forwarded and
 * handlers removed on close; tooling output is independent of CLI rebuilds.
 * Buffered output is spooled to a private temporary file, replayed to stderr on
 * failure, and removed on completion. Success (including warnings) and cancellation
 * discard it. Verbose/unmanaged output always streams, regardless of this option.
 * Inherits cwd and environment: callers must select the workspace owning the command.
 * STAM_DEV_SESSION enables managed output unless STAM_DEV_VERBOSE=1. No shell is used.
 * Executable usage: `node turbo.js <turbo args>`; importing does not launch a process.
 */
export async function runTurbo(args: string[], { bufferOutput = false }: { bufferOutput?: boolean } = {}): Promise<number> {
    const quiet = !!process.env.STAM_DEV_SESSION && process.env.STAM_DEV_VERBOSE !== '1';
    const directory = quiet && bufferOutput ? fs.mkdtempSync(path.join(os.tmpdir(), 'stam-shared-log-')) : undefined;
    const file = directory ? path.join(directory, 'output.log') : undefined;
    const fd = file ? fs.openSync(file, 'wx', 0o600) : undefined;
    const write = (stream: 'stdout' | 'stderr', text: string) => fd === undefined ? process[stream].write(text) : fs.writeSync(fd, text);
    const child = spawn('pnpm', [...args, ...(quiet ? ['--json'] : [])], { stdio: quiet ? ['inherit', 'pipe', fd === undefined ? 'inherit' : 'pipe'] : 'inherit' });
    if (child.stdout) {
        createInterface({ input: child.stdout, crlfDelay: Infinity }).on('line', line => forwardTurboLine(line, write));
    }
    child.stderr?.setEncoding('utf8').on('data', (text: string) => write('stderr', text));
    let cancelled = false;
    const interrupt = () => {
        cancelled = true;
        child.kill('SIGINT');
    };
    const terminate = () => {
        cancelled = true;
        child.kill('SIGTERM');
    };
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', terminate);
    try {
        const code = await new Promise<number>((resolve) => {
            child.once('error', (error) => {
                console.error(error);
                resolve(1);
            });
            child.once('close', code => resolve(code ?? 1));
        });
        if (file && code !== 0 && !cancelled) {
            await pipeline(fs.createReadStream(file), process.stderr, { end: false });
        }
        return code;
    } finally {
        process.off('SIGINT', interrupt);
        process.off('SIGTERM', terminate);
        if (fd !== undefined) fs.closeSync(fd);
        if (directory) fs.rmSync(directory, { recursive: true, force: true });
    }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exitCode = await runTurbo(['exec', 'turbo', ...process.argv.slice(2)]);
}
