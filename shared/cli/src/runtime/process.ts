import { hasLogSink } from '@common/opentelemetry-decorators';
import { processError, runProcess } from '@node/opentelemetry-process';
import type { ProcessOptions, ProcessResult } from '@node/opentelemetry-process';
import { getCliTelemetry, withCliPrompt } from './telemetry.js';

/** env is a complete environment, matching runProcess. Use run() for legacy merged-env callers. */
export async function execResult(command: string, args: string[], options: ProcessOptions = {}): Promise<ProcessResult> {
    const runtime = getCliTelemetry();
    const execute = () => runProcess(command, args, {
        signal: runtime?.signal,
        processGroup: !options.inheritStdin && !options.inheritStdio,
        ...options,
        log: options.log ?? (hasLogSink()
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
export async function exec(command: string, args: string[], options: ProcessOptions = {}): Promise<ProcessResult> {
    const result = await execResult(command, args, options);
    if (result.code !== 0) throw processError(options.label || `${command} failed.`, command, result);
    return result;
}
