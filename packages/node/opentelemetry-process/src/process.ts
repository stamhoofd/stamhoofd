import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { stripVTControlCharacters } from 'node:util';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { constants } from 'node:os';
import { diagnostic, instrument, log, markSpanFailed } from '@common/opentelemetry-decorators';
import type { LogSink } from '@common/opentelemetry-decorators';
import { trace } from '@opentelemetry/api';

/** Execution, cancellation and presentation options for {@link runProcess}. */
export type ProcessOptions = {
    /** Defaults to the redacted command line. Use a description to override it, or false to hide progress. */
    label?: string | false;
    /** Child working directory; defaults to the current process directory. */
    cwd?: string;
    /** Complete child environment, replacing process.env rather than merging it. */
    env?: NodeJS.ProcessEnv;
    /** Cancellation returns code 130. An already aborted signal prevents spawning. */
    signal?: AbortSignal;
    /** Deadline in milliseconds; expiry returns code 124. */
    timeoutMs?: number;
    /** Grace period before SIGKILL after cancellation, timeout or capture overflow. */
    killAfterMs?: number;
    /** POSIX: terminate the child process group, including descendants. */
    processGroup?: boolean;
    /** Maximum captured stdout characters; exceeding this terminates the process. Default 16 MiB. */
    maxCaptureChars?: number;
    /** Maximum streamed diagnostic characters per process. Default 1 MiB. */
    maxDiagnosticChars?: number;
    /** Debug by default; always streams at info level; on-failure spools redacted output and replays at error level. */
    output?: 'verbose' | 'always' | 'on-failure';
    /** Plain output omits renderer gutters while retaining coordinated, redacted diagnostics. */
    outputStyle?: 'plain' | 'decorated';
    /** Known secrets to redact from labels, diagnostics and retained stderr, including JSON-escaped forms. */
    redact?: string[];
    /** Optional destination for applications without a scoped OpenTelemetry log sink. */
    log?: LogSink;
} & (
    | {
          /** Interactive passthrough. Output bypasses capture, diagnostics and redaction. */
          inheritStdio: true;
          inheritStdin?: never;
          input?: never;
          capture?: false;
          sanitizeStdout?: never;
      }
    | ({
          inheritStdio?: false;
          /** Return raw stdout to the caller; only diagnostics are sanitized. Defaults to false. */
          capture?: boolean;
          /** Buffer and sanitize structured stdout before diagnostics; thrown errors withhold output. */
          sanitizeStdout?: (stdout: string) => string;
      } & (
          | {
                /** Inherit stdin while retaining output diagnostics; cannot be combined with input. */
                inheritStdin?: boolean;
                input?: never;
            }
          | {
                inheritStdin?: false;
                /** Text or a Readable piped with backpressure. Input errors terminate execution. */
                input?: string | Readable;
            }
      ))
);

/** Completed execution, including nonzero exits and controlled termination. */
export type ProcessResult = {
    /** Exit status, or 130 for cancellation, 124 for timeout, and 1 for input/capture failure. */
    code: number;
    /** Raw captured stdout, otherwise empty. A failed result may contain incomplete output. */
    stdout: string;
    /** Redacted final 8192 characters, with empty/truncated markers; never raw stderr. */
    stderr: string;
    /** Direct child's terminating signal, if any; null when no child was spawned. */
    signal: NodeJS.Signals | null;
    /** Library-initiated termination cause; ordinary nonzero exits have no reason. */
    reason?: 'aborted' | 'timeout' | 'output-limit' | 'input-error';
    /** True only if every stderr chunk was acknowledged by the presentation sink. */
    stderrReported?: boolean;
    /** Redacted NDJSON retained only when the sink could not present the complete failure log. Caller owns removal. */
    diagnosticsFile?: string;
};

/**
 * Builds an error for a command boundary that chooses to reject a failed result.
 * @param message - Safe contextual description; no additional redaction is applied.
 * @param command - Safe command description, e.g. from {@link formatCommandLine}.
 * @param result - Failed execution whose stderr is included unless fully acknowledged.
 * @returns An Error containing exit status, signal/reason and unreported stderr.
 * @remarks This function neither throws nor logs. Retained stderr stays available
 * on the original result even when omitted from the message to avoid repetition.
 */
export function processError(
    message: string,
    command: string,
    result: Pick<ProcessResult, 'code'> & Partial<ProcessResult>,
): Error {
    const status = `${message}\n  Command: ${command}\n  Exit code: ${result.code}${result.signal ? `\n  Signal: ${result.signal}` : ''}${result.reason ? `\n  Reason: ${result.reason}` : ''}${result.diagnosticsFile ? `\n  Diagnostics: ${result.diagnosticsFile}` : ''}`;
    return new Error(
        result.stderrReported
            ? status
            : `${status}\n\n  ${command.split(' ')[0]} stderr:\n    ${(result.stderr ?? '(no stderr returned)').replaceAll('\n', '\n    ')}`,
    );
}

/** Hold potential secret prefixes between chunks, redacting before emitting or truncating. */
function redactor(secrets: string[], emit: (text: string) => void) {
    let pending = '';
    let covered = 0;
    const longest = Math.max(0, ...secrets.map((secret) => secret.length));
    return (text: string, final = false) => {
        pending += text;
        const end = final ? pending.length : Math.max(0, pending.length - longest);
        if (end === 0) return;
        const matches: { start: number; end: number }[] = [];
        if (covered) matches.push({ start: 0, end: covered });
        for (const secret of secrets) {
            let start = pending.indexOf(secret);
            while (start !== -1) {
                matches.push({ start, end: start + secret.length });
                start = pending.indexOf(secret, start + 1);
            }
        }
        // Carry only the covered suffix of an already emitted redaction. Merging
        // it with new matches lets arbitrarily long overlapping runs stream safely.
        const ranges: { start: number; end: number }[] = [];
        for (const match of matches.sort((a, b) => a.start - b.start)) {
            const previous = ranges.at(-1);
            if (previous && match.start < previous.end)
                previous.end = Math.max(previous.end, match.end);
            else ranges.push({ ...match });
        }
        let ready = '';
        let cursor = 0;
        let nextCovered = 0;
        for (const range of ranges) {
            if (range.start >= end) break;
            ready += pending.slice(cursor, range.start);
            if (range.start !== 0 || covered === 0) ready += '[redacted]';
            cursor = Math.min(range.end, end);
            nextCovered = Math.max(0, range.end - end);
        }
        ready += pending.slice(cursor, end);
        pending = pending.slice(end);
        covered = nextCovered;
        if (ready) emit(ready);
    };
}

function redactionValues(values: string[] = []): string[] {
    return [
        ...new Set(
            values.filter(Boolean).flatMap((value) => [value, JSON.stringify(value).slice(1, -1)]),
        ),
    ].sort((a, b) => b.length - a.length);
}

function sanitize(value: string, secrets: string[]): string {
    let result = '';
    redactor(secrets, (text) => {
        result += text;
    })(value, true);
    return stripVTControlCharacters(result);
}

/**
 * Formats a quoted, redacted plain-text command for progress, diagnostics or errors.
 * @param command - Executable name or path.
 * @param args - Arguments passed separately to spawn, without shell interpolation.
 * @param redact - Known secrets, including their JSON-escaped representations.
 * @returns Display text with terminal escape sequences removed; not a shell script.
 */
export function formatCommandLine(command: string, args: string[], redact: string[] = []): string {
    return sanitize(
        [command, ...args]
            .map((value) => (/^[\w./:=@+-]+$/.test(value) ? value : JSON.stringify(value)))
            .join(' '),
        redactionValues(redact),
    );
}

function finishResult(result: ProcessResult): ProcessResult {
    try {
        trace.getActiveSpan()?.setAttribute('process.exit.code', result.code);
    } catch {
        /* Span processors are best-effort. */
    }
    if (result.code !== 0) markSpanFailed();
    return result;
}

/**
 * Executes a subprocess without a shell inside an active process span.
 * @param command - Executable name or path.
 * @param args - Arguments passed verbatim; unknown secrets must not appear here.
 * @param options - Stdio mode, output limits, redaction and cancellation settings.
 * @returns Exit status and output. Nonzero exits, cancellation, timeout and capture
 * overflow resolve with a failed result; they do not throw. Use {@link processError}
 * at the command boundary when a failed result should become an exception.
 * @throws For invalid options or spawn failures. Spawn error messages are redacted.
 * @remarks The application owns the SDK and logging sink. Cancellation sends SIGTERM,
 * then SIGKILL after the grace period. POSIX process-group escalation is retained
 * even if the direct child exits first. Captured stdout is raw and may be incomplete
 * on failure; diagnostics are redacted, and stderr retains only a bounded tail.
 * Synchronous sink errors cannot change the process result. Limits count UTF-16
 * code units, not bytes. Interactive passthrough cannot capture or sanitize stdout.
 *
 * @example
 * ```ts
 * const result = await runProcess('git', ['status', '--porcelain'], {
 *     capture: true,
 *     timeoutMs: 10_000,
 * });
 * if (result.code !== 0) throw processError('Could not inspect repository.', 'git status', result);
 * ```
 */
export const runProcess = instrument(
    'process.run',
    async function (
        command: string,
        args: string[],
        options: ProcessOptions = {},
    ): Promise<ProcessResult> {
        const emit: LogSink = (level, message, fields) => {
            try {
                return (options.log ?? log)(level, message, {
                    ...fields,
                    'diagnostic.output.style': options.outputStyle,
                });
            } catch {
                return false;
            }
        };
        const secrets = redactionValues(options.redact);
        const clean = (value: string) => sanitize(value, secrets);
        diagnostic(
            { kind: 'command', message: formatCommandLine(command, args, options.redact) },
            emit,
        );
        if ((options.inheritStdin || options.inheritStdio) && options.input !== undefined)
            throw new Error('Inherited stdin cannot be combined with input.');
        if (options.inheritStdio && (options.capture || options.sanitizeStdout !== undefined))
            throw new Error(
                'Inherited stdio cannot be combined with capture or stdout sanitization.',
            );
        if (options.inheritStdio && options.output === 'on-failure')
            throw new Error('Inherited stdio cannot retain failure diagnostics.');
        for (const limit of [
            options.timeoutMs,
            options.killAfterMs,
            options.maxCaptureChars,
            options.maxDiagnosticChars,
        ]) {
            if (limit !== undefined && (!Number.isFinite(limit) || limit < 0))
                throw new Error('Process limits must be finite nonnegative numbers.');
        }
        if (options.signal?.aborted)
            return finishResult({
                code: 130,
                signal: null,
                reason: 'aborted',
                stdout: '',
                stderr: '(no stderr returned)',
            });
        const directory =
            options.output === 'on-failure'
                ? fs.mkdtempSync(path.join(os.tmpdir(), 'process-log-'))
                : undefined;
        const file = directory ? path.join(directory, 'output.ndjson') : undefined;
        let fd: number | undefined;
        let retainSpool = false;
        try {
            fd = file ? fs.openSync(file, 'wx', 0o600) : undefined;
        } catch (error) {
            if (directory) fs.rmSync(directory, { recursive: true, force: true });
            throw error;
        }
        return await new Promise<ProcessResult>((resolve, reject) => {
            const grouped = options.processGroup === true && process.platform !== 'win32';
            const child = spawn(command, args, {
                cwd: options.cwd,
                env: options.env ?? process.env,
                detached: grouped,
                stdio: options.inheritStdio
                    ? 'inherit'
                    : [
                          options.inheritStdin
                              ? 'inherit'
                              : options.input === undefined
                                ? 'ignore'
                                : 'pipe',
                          'pipe',
                          'pipe',
                      ],
            });
            let reason: ProcessResult['reason'];
            let closed = false;
            let timeout: ReturnType<typeof setTimeout> | undefined;
            let escalation: ReturnType<typeof setTimeout> | undefined;
            let escalated: Promise<void> | undefined;
            const kill = (signal: NodeJS.Signals) => {
                try {
                    if (grouped && child.pid) process.kill(-child.pid, signal);
                    else child.kill(signal);
                } catch (error) {
                    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') child.kill(signal);
                }
            };
            const stop = (cause: NonNullable<ProcessResult['reason']>) => {
                if (reason || closed) return;
                reason = cause;
                kill('SIGTERM');
                escalated = new Promise<void>((resolve) => {
                    escalation = setTimeout(() => {
                        kill('SIGKILL');
                        resolve();
                    }, options.killAfterMs ?? 2000);
                });
            };
            const abort = () => stop('aborted');
            options.signal?.addEventListener('abort', abort, { once: true });
            if (options.signal?.aborted) abort();
            if (options.timeoutMs !== undefined)
                timeout = setTimeout(() => stop('timeout'), options.timeoutMs);
            const cleanup = () => {
                closed = true;
                if (timeout) clearTimeout(timeout);
                if (escalation) clearTimeout(escalation);
                options.signal?.removeEventListener('abort', abort);
            };
            if (child.stdin && options.input !== undefined) {
                const input =
                    typeof options.input === 'string'
                        ? Readable.from([options.input])
                        : options.input;
                void pipeline(input, child.stdin).catch((error: NodeJS.ErrnoException) => {
                    if (error.code !== 'EPIPE' && error.code !== 'ERR_STREAM_PREMATURE_CLOSE')
                        stop('input-error');
                });
            }
            let stdout = '';
            let stderr = '';
            let truncated = false;
            let diagnosticSize = 0;
            let diagnosticLimit = false;
            let stderrReported = true;
            let hasStderr = false;
            let spoolError: unknown;
            const output = (text: string, kind: 'stdout' | 'stderr') => {
                if (fd !== undefined) {
                    try {
                        fs.writeSync(fd, JSON.stringify({ kind, text }) + '\n');
                    } catch (error) {
                        spoolError = error;
                        stop('output-limit');
                    }
                    return false;
                }
                if (diagnosticLimit) return false;
                diagnosticSize += text.length;
                if (diagnosticSize > (options.maxDiagnosticChars ?? 1024 * 1024)) {
                    diagnosticLimit = true;
                    diagnostic(
                        {
                            kind: 'output',
                            stream: kind,
                            message: '[process diagnostics truncated]\n',
                            always: options.output === 'always',
                        },
                        emit,
                    );
                    return false;
                }
                return diagnostic(
                    {
                        kind: 'output',
                        stream: kind,
                        message: text,
                        always: options.output === 'always',
                    },
                    emit,
                );
            };
            const stdoutDiagnostic = redactor(secrets, (text) => output(text, 'stdout'));
            const stderrDiagnostic = redactor(secrets, (text) => {
                stderr += stripVTControlCharacters(text);
                if (stderr.length > 8192) {
                    truncated = true;
                    stderr = stderr.slice(-8192);
                }
                hasStderr = true;
                stderrReported = output(text, 'stderr') && stderrReported;
            });
            child.stdout?.setEncoding('utf8');
            child.stderr?.setEncoding('utf8');
            child.stdout?.on('data', (text: string) => {
                if (options.capture || options.sanitizeStdout) {
                    const remaining = Math.max(
                        0,
                        (options.maxCaptureChars ?? 16 * 1024 * 1024) - stdout.length,
                    );
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
            const finish = async (code: number | null, signal: NodeJS.Signals | null) => {
                if (closed) return;
                try {
                    if (grouped && child.pid && escalated) {
                        let exists = true;
                        try {
                            process.kill(-child.pid, 0);
                        } catch (error) {
                            if ((error as NodeJS.ErrnoException).code === 'ESRCH') exists = false;
                        }
                        if (exists) await escalated;
                    }
                    cleanup();
                    if (options.sanitizeStdout) {
                        let safe: string;
                        try {
                            safe =
                                reason === 'output-limit'
                                    ? '[stdout withheld: capture limit exceeded]\n'
                                    : options.sanitizeStdout(stdout);
                        } catch {
                            safe = '[stdout withheld: unable to sanitize structured output]\n';
                        }
                        stdoutDiagnostic(safe, true);
                    } else stdoutDiagnostic('', true);
                    stderrDiagnostic('', true);
                    // eslint-disable-next-line security/detect-object-injection -- Node supplies the signal name; this reads the OS signal-number table.
                    const status = reason
                        ? reason === 'aborted'
                            ? 130
                            : reason === 'timeout'
                              ? 124
                              : 1
                        : (code ?? (signal ? 128 + constants.signals[signal] : 1));
                    if (spoolError)
                        throw new Error(
                            `Could not retain process diagnostics: ${clean(spoolError instanceof Error ? spoolError.message : 'Unknown write error')}`,
                        );
                    if (file && status !== 0 && reason !== 'aborted') {
                        stderrReported = true;
                        const lines = createInterface({
                            input: fs.createReadStream(file),
                            crlfDelay: Infinity,
                        });
                        for await (const line of lines) {
                            const record = JSON.parse(line) as {
                                kind: 'stdout' | 'stderr';
                                text: string;
                            };
                            const reported = emit('error', record.text, {
                                'diagnostic.kind': record.kind,
                            });
                            if (reported !== true) retainSpool = true;
                            if (record.kind === 'stderr')
                                stderrReported = reported === true && stderrReported;
                        }
                    }
                    resolve(
                        finishResult({
                            code: status,
                            signal: signal ?? null,
                            reason,
                            stderrReported:
                                (hasStderr || (!!file && status !== 0 && reason !== 'aborted')) &&
                                stderrReported,
                            diagnosticsFile: retainSpool ? file : undefined,
                            stdout: options.capture ? stdout : '',
                            stderr: `${truncated ? '[stderr truncated]\n' : ''}${stderr.trim() || '(no stderr returned)'}`,
                        }),
                    );
                } catch (error) {
                    cleanup();
                    reject(error);
                }
            };
            child.once('close', (code: number | null, signal: NodeJS.Signals | null) => {
                void finish(code, signal);
            });
        }).finally(() => {
            if (fd !== undefined) fs.closeSync(fd);
            if (directory && !retainSpool) fs.rmSync(directory, { recursive: true, force: true });
        });
    },
    {
        fields: ([command, args, options]) => ({
            'process.executable.name': command,
            'operation.label':
                options?.label === false
                    ? undefined
                    : options?.label === undefined
                      ? formatCommandLine(command, args, options?.redact)
                      : sanitize(options.label, redactionValues(options.redact)),
            'operation.label.kind': options?.label === undefined ? 'command' : 'description',
        }),
    },
);
