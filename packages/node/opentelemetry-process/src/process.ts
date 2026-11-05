import { spawn } from 'node:child_process';
import { stripVTControlCharacters } from 'node:util';
import { diagnosticKind, instrumentFunction, log, markSpanFailed } from '@common/opentelemetry-decorators';
import type { LogSink } from '@common/opentelemetry-decorators';
import { trace } from '@opentelemetry/api';

export type ProcessOptions = {
    cwd?: string;
    env?: NodeJS.ProcessEnv;
    input?: string;
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
export type ProcessResult = { code: number; stdout: string; stderr: string };

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
        try { (options.log ?? log)(...event); } catch { /* Diagnostics must not interrupt subprocess draining. */ }
    };
    const secrets = [...new Set((options.redact ?? []).filter(Boolean).flatMap(value => [value, JSON.stringify(value).slice(1, -1)]))].sort((a, b) => b.length - a.length);
    const clean = (value: string) => {
        let result = '';
        redactor(secrets, (text) => { result += text; })(value, true);
        return stripVTControlCharacters(result);
    };
    const commandLine = [command, ...args].map(value => /^[\w./:=@+-]+$/.test(value) ? value : JSON.stringify(value)).join(' ');
    emit('debug', clean(commandLine), { [diagnosticKind]: 'command' });
    const level = options.output === 'always' ? 'info' : 'debug';
    return await new Promise<ProcessResult>((resolve, reject) => {
        const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? process.env, stdio: options.inheritStdio ? 'inherit' : [options.input === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'] });
        child.stdin?.on('error', () => {});
        if (options.input !== undefined) child.stdin?.end(options.input);
        let stdout = '';
        let stderr = '';
        let truncated = false;
        const stdoutDiagnostic = redactor(secrets, text => emit(level, text, { [diagnosticKind]: 'stdout' }));
        const stderrDiagnostic = redactor(secrets, (text) => {
            stderr += stripVTControlCharacters(text);
            if (stderr.length > 8192) { truncated = true; stderr = stderr.slice(-8192); }
            emit(level, text, { [diagnosticKind]: 'stderr' });
        });
        child.stdout?.setEncoding('utf8');
        child.stderr?.setEncoding('utf8');
        child.stdout?.on('data', (text: string) => {
            if (options.capture || options.sanitizeStdout) stdout += text;
            if (!options.sanitizeStdout) stdoutDiagnostic(text);
        });
        child.stderr?.on('data', (text: string) => stderrDiagnostic(text));
        child.once('error', () => reject(new Error(`Could not start ${command}. Check that it is installed.`)));
        child.once('close', (code) => {
            try {
                if (options.sanitizeStdout) {
                    let safe: string;
                    try { safe = options.sanitizeStdout(stdout); } catch { safe = '[stdout withheld: unable to sanitize structured output]\n'; }
                    stdoutDiagnostic(safe, true);
                } else stdoutDiagnostic('', true);
                stderrDiagnostic('', true);
                trace.getActiveSpan()?.setAttribute('process.exit.code', code ?? 1);
                if (code !== 0) markSpanFailed();
                resolve({ code: code ?? 1, stdout: options.capture ? stdout : '', stderr: `${truncated ? '[stderr truncated]\n' : ''}${stderr.trim() || '(no stderr returned)'}` });
            } catch (error) { reject(error); }
        });
    });
}, { fields: ([command]) => ({ 'process.executable.name': command }) });
