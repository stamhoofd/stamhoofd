import { hasLogSink } from '@common/opentelemetry-decorators';
import { formatCommandLine, processError, runProcess } from '@node/opentelemetry-process';
import type { ProcessOptions, ProcessResult } from '@node/opentelemetry-process';
import { getCliTelemetry, withCliInteractiveOperation, withCliPrompt } from './telemetry.js';

/** env is a complete environment, matching runProcess. Use run() for legacy merged-env callers. */
export async function execResult(
    command: string,
    args: string[],
    options: ProcessOptions = {},
): Promise<ProcessResult> {
    const runtime = getCliTelemetry();
    const execute = () =>
        runProcess(command, args, {
            signal: runtime?.signal,
            ...options,
            processGroup: options.processGroup ?? (!options.inheritStdin && !options.inheritStdio),
            log:
                options.log ??
                (hasLogSink()
                    ? undefined
                    : (level, message) => {
                          if (level === 'debug') return false;
                          process.stderr.write(message);
                          return true;
                      }),
        });
    return options.inheritStdio ? withCliPrompt(execute) : execute();
}

/** Checked execution for ordinary operations. Use execResult for meaningful nonzero exit codes. */
export async function exec(
    command: string,
    args: string[],
    options: ProcessOptions = {},
): Promise<ProcessResult> {
    const result = await execResult(command, args, options);
    if (result.code !== 0)
        throw processError(options.label || `${command} failed.`, command, result);
    return result;
}

/** For short sudo setup operations. Use label: false when the task already previews its commands; sudo then owns native terminal IO. */
export async function execSudo(
    args: string[],
    options: Pick<ProcessOptions, 'cwd' | 'env' | 'redact'> & { label?: false } = {},
): Promise<ProcessResult> {
    if (options.label === false) {
        const result = await execResult('sudo', args, { ...options, inheritStdio: true });
        if (result.code !== 0)
            throw processError(
                `Failed: ${formatCommandLine('sudo', args, options.redact)}`,
                'sudo',
                result,
            );
        return result;
    }
    if (!process.stdin.isTTY) return exec('sudo', args, { ...options, inheritStdio: true });
    return withCliInteractiveOperation(formatCommandLine('sudo', args, options.redact), (write) =>
        exec('sudo', ['-S', ...args], {
            ...options,
            inheritStdin: true,
            label: false,
            output: 'always',
            log: (_level, message, fields) =>
                fields['diagnostic.kind'] === 'stdout' || fields['diagnostic.kind'] === 'stderr'
                    ? write(message)
                    : false,
        }),
    );
}
