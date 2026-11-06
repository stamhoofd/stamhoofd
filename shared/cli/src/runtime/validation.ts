import { context as telemetryContext, trace } from '@opentelemetry/api';
import { log, withSpan } from '@common/opentelemetry-decorators';
import type { CliContext } from '../context/create-context.js';
import { run, RunVerbosity } from './command-runner.js';
import { formatTestCounts, openTestEventChannel } from './test-events.js';

/** Finite checks retain diagnostics on failure; live counters come only from reporter NDJSON. */
export async function runValidation(context: CliContext, label: string, args: string[], options: { cwd?: string; env?: NodeJS.ProcessEnv; tests?: boolean } = {}) {
    return withSpan('cli.validation', async () => {
        const span = trace.getActiveSpan();
        const channel = options.tests ? await openTestEventChannel(telemetryContext.bind(telemetryContext.active(), (event) => {
            if (event.finished) span?.setAttribute('operation.summary', formatTestCounts(event));
            else log('info', `${event.completed}${event.total === undefined ? '' : `/${event.total}`} completed${event.failed ? ` · ${event.failed} failed` : ''}`, { 'operation.progress': true, 'operation.progress.liveOnly': true });
        })) : undefined;
        try {
            const verbosity = context.verbosity ?? (context.verbose ? RunVerbosity.Output : RunVerbosity.Command);
            await run('pnpm', args, {
                cwd: options.cwd ?? context.rootDir,
                env: { ...options.env, ...channel?.env },
                verbosity,
                output: verbosity === RunVerbosity.Output ? 'always' : 'on-failure',
            });
        } finally {
            await channel?.close();
        }
    }, { label });
}
