import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { constants } from 'node:os';
import { diagnostic, instrumentFunction, log, markSpanFailed } from '@common/opentelemetry-decorators';
import type { LogSink } from '@common/opentelemetry-decorators';
import { trace } from '@opentelemetry/api';

export type ProcessOptions = {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    input?: string | Readable;
    /** Inherit stdin while retaining redacted output diagnostics. */
    inheritStdin?: boolean;
    signal?: AbortSignal;
    timeoutMs?: number;
    /** Grace period before SIGKILL after cancellation, timeout or capture overflow. */
    killAfterMs?: number;
    /** POSIX: terminate the child process group, including descendants. */
    processGroup?: boolean;
    /** Maximum captured stdout characters; exceeding this terminates the process. Default 16 MiB. */
    maxCaptureChars?: number;
    /** Maximum streamed diagnostic characters per process. Default 1 MiB. */
    maxDiagnosticChars?: number;
    /** Raw stdout is returned to the caller; only sanitized diagnostics are emitted. */
    capture?: boolean;
    output?: 'verbose' | 'always';
    /** Interactive passthrough; output bypasses diagnostics, capture and redaction. */
    inheritStdio?: boolean;
    redact?: string[];
    /** Use for structured output containing secrets not known before execution. */
    sanitizeStdout?: (stdout: string) => string;
    /** Optional destination for applications without a scoped OpenTelemetry log sink. */
    log?: LogSink;
};
export type ProcessResult = {
    code: number;
    stdout: string;
    stderr: string;
    signal: NodeJS.Signals | null;
    reason?: 'aborted' | 'timeout' | 'output-limit' | 'input-error';
    /** True only if every stderr chunk was acknowledged by the presentation sink. */
    stderrReported?: boolean;
};

/** The command boundary owns reporting; retained stderr remains available for programmatic inspection. */
export function processError(message: string, command: string, result: Pick<ProcessResult, 'code'> & Partial<ProcessResult>): Error {
    const status = `${message}\n  Command: ${command}\n  Exit code: ${result.code}${result.signal ? `\n  Signal: ${result.signal}` : ''}${result.reason ? `\n  Reason: ${result.reason}` : ''}`;
    return new Error(result.stderrReported ? status : `${status}\n\n  ${command.split(' ')[0]} stderr:\n    ${(result.stderr ?? '(no stderr returned)').replaceAll('\n', '\n    ')}`);
}

/** Hold potential secret prefixes between chunks, redacting before emitting or truncating. */
function redactor(secrets: string[], emit: (text: string) => void) {
    let pending = '';
    const longest = Math.max(0, ...secrets.map(secret => secret.length));
    return (text: string, final = false) => {
        pending += text;
        let end = final ? pending.length : Math.max(0, pending.length - longest);
        const matches: { start: number; end: number }[] = [];
        for (const secret of secrets) {
            let start = pending.indexOf(secret);
            while (start !== -1) {
                matches.push({ start, end: start + secret.length });
                start = pending.indexOf(secret, start + 1);
            }
        }
        // Merge first: shortening the emission boundary for one secret must not
        // split a previously examined, overlapping secret.
        const ranges: { start: number; end: number }[] = [];
        for (const match of matches.sort((a, b) => a.start - b.start)) {
            const previous = ranges.at(-1);
            if (previous && match.start < previous.end) previous.end = Math.max(previous.end, match.end);
            else ranges.push({ ...match });
        }
        for (const range of ranges) {
            if (range.start < end && range.end > end) end = range.start;
        }
        let ready = '';
        let cursor = 0;
        for (const range of ranges) {
            if (range.end > end) break;
            ready += pending.slice(cursor, range.start) + '[redacted]';
            cursor = range.end;
        }
        ready += pending.slice(cursor, end);
        pending = pending.slice(end);
        if (ready) emit(ready);
    };
}

export const runProcess = instrumentFunction('process.run', async function (command: string, args: string[], options: ProcessOptions = {}): Promise<ProcessResult> {
    const emit: LogSink = (...event) => {
        try { return (options.log ?? log)(...event); } catch { return false; }
    };
    const secrets = [...new Set((options.redact ?? []).filter(Boolean).flatMap(value => [value, JSON.stringify(value).slice(1, -1)]))].sort((a, b) => b.length - a.length);
    const clean = (value: string) => {
        let result = '';
        redactor(secrets, (text) => { result += text; })(value, true);
        return stripVTControlCharacters(result);
    };
    const commandLine = [command, ...args].map(value => /^[\w./:=@+-]+$/.test(value) ? value : JSON.stringify(value)).join(' ');
    diagnostic({ kind: 'command', message: clean(commandLine) }, emit);
    if (options.signal?.aborted) return { code: 130, signal: null, reason: 'aborted', stdout: '', stderr: '(no stderr returned)' };
    if ((options.inheritStdin || options.inheritStdio) && options.input !== undefined) throw new Error('Inherited stdin cannot be combined with input.');
    for (const limit of [options.timeoutMs, options.killAfterMs, options.maxCaptureChars, options.maxDiagnosticChars]) {
        if (limit !== undefined && (!Number.isFinite(limit) || limit < 0)) throw new Error('Process limits must be finite nonnegative numbers.');
    }
    return await new Promise<ProcessResult>((resolve, reject) => {
        const grouped = options.processGroup === true && process.platform !== 'win32';
        const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? process.env, detached: grouped, stdio: options.inheritStdio ? 'inherit' : [options.inheritStdin ? 'inherit' : options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
        let reason: ProcessResult['reason'];
        let closed = false;
        let timeout: ReturnType<typeof setTimeout> | undefined;
        let escalation: ReturnType<typeof setTimeout> | undefined;
        const kill = (signal: NodeJS.Signals) => {
            try {
                if (grouped && child.pid) process.kill(-child.pid, signal);
                else child.kill(signal);
            } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') child.kill(signal); }
        };
        const stop = (cause: NonNullable<ProcessResult['reason']>) => {
            if (reason || closed) return;
            reason = cause;
            kill('SIGTERM');
            escalation = setTimeout(() => kill('SIGKILL'), options.killAfterMs ?? 2000);
        };
        const abort = () => stop('aborted');
        options.signal?.addEventListener('abort', abort, { once: true });
        if (options.signal?.aborted) abort();
        if (options.timeoutMs !== undefined) timeout = setTimeout(() => stop('timeout'), options.timeoutMs);
        const cleanup = () => {
            closed = true;
            if (timeout) clearTimeout(timeout);
            if (escalation) clearTimeout(escalation);
            options.signal?.removeEventListener('abort', abort);
        };
        if (child.stdin && options.input !== undefined) {
            const input = typeof options.input === 'string' ? Readable.from([options.input]) : options.input;
            void pipeline(input, child.stdin).catch((error: NodeJS.ErrnoException) => {
                if (error.code !== 'EPIPE' && error.code !== 'ERR_STREAM_PREMATURE_CLOSE') stop('input-error');
            });
        }
        let stdout = '';
        let stderr = '';
        let truncated = false;
        let diagnosticSize = 0;
        let diagnosticLimit = false;
        let stderrReported = true;
        let hasStderr = false;
        const output = (text: string, kind: 'stdout' | 'stderr') => {
            if (diagnosticLimit) return false;
            diagnosticSize += text.length;
            if (diagnosticSize > (options.maxDiagnosticChars ?? 1024 * 1024)) {
                diagnosticLimit = true;
                diagnostic({ kind: 'output', stream: kind, message: '[process diagnostics truncated]\n', always: options.output === 'always' }, emit);
                return false;
            }
            return diagnostic({ kind: 'output', stream: kind, message: text, always: options.output === 'always' }, emit);
        };
        const stdoutDiagnostic = redactor(secrets, text => output(text, 'stdout'));
        const stderrDiagnostic = redactor(secrets, (text) => {
            stderr += stripVTControlCharacters(text);
            if (stderr.length > 8192) { truncated = true; stderr = stderr.slice(-8192); }
            hasStderr = true;
            stderrReported = output(text, 'stderr') && stderrReported;
        });
        child.stdout?.setEncoding('utf8');
        child.stderr?.setEncoding('utf8');
        child.stdout?.on('data', (text: string) => {
            if (options.capture || options.sanitizeStdout) {
                const remaining = Math.max(0, (options.maxCaptureChars ?? 16 * 1024 * 1024) - stdout.length);
                stdout += text.slice(0, remaining);
                if (text.length > remaining) stop('output-limit');
            }
            if (!options.sanitizeStdout) stdoutDiagnostic(text);
        });
        child.stderr?.on('data', (text: string) => stderrDiagnostic(text));
        child.once('error', (error) => {
            cleanup();
            reject(new Error(clean(error.message)));
        });
        child.once('close', (code: number | null, signal: NodeJS.Signals | null) => {
            cleanup();
            try {
                if (options.sanitizeStdout) {
                    let safe: string;
                    try { safe = reason === 'output-limit' ? '[stdout withheld: capture limit exceeded]\n' : options.sanitizeStdout(stdout); } catch { safe = '[stdout withheld: unable to sanitize structured output]\n'; }
                    stdoutDiagnostic(safe, true);
                } else stdoutDiagnostic('', true);
                stderrDiagnostic('', true);
                const status = reason ? reason === 'aborted' ? 130 : reason === 'timeout' ? 124 : 1 : code ?? (signal ? 128 + constants.signals[signal] : 1);
                try { trace.getActiveSpan()?.setAttribute('process.exit.code', status); } catch { /* Span processors are best-effort. */ }
                if (status !== 0) markSpanFailed();
                resolve({ code: status, signal: signal ?? null, reason, stderrReported: hasStderr && stderrReported, stdout: options.capture ? stdout : '', stderr: `${truncated ? '[stderr truncated]\n' : ''}${stderr.trim() || '(no stderr returned)'}` });
            } catch (error) { reject(error); }
        });
    });
}, { fields: ([command]) => ({ 'process.executable.name': command }) });
