import { errorDiagnostics } from '@common/errors';
import { Database } from '@node/database';
import { WorkerMetrics } from '@node/observability/worker-metrics';
import { backendRecord, logger, StyledText } from '@node/logging';
import { sleep } from '@stamhoofd/utility';

export type CronJobDefinition = {
    name: string;
    method: () => Promise<void>;
    running: boolean;
};

const registeredCronJobs: CronJobDefinition[] = [];
let dispatch: WorkerMetrics | undefined;

let areSeedsNotFinished = true;

export function markAllSeedsFinished() {
    areSeedsNotFinished = false;
}

export function registerCron(name: string, method: () => Promise<void>) {
    dispatch ??= new WorkerMetrics('cron_dispatch');
    registeredCronJobs.push({
        name,
        method,
        running: false,
    });
}

async function run(name: string, handler: () => Promise<void>) {
    const finish = dispatch?.start();
    let outcome: 'returned' | 'error' = 'returned';
    try {
        await logger.setContext(
            {
                prefixes: [new StyledText(`[${name}] `).addClass('crons', 'tag')],
                tags: ['crons'],
            },
            async () => {
                try {
                    await handler();
                } catch (error) {
                    console.error('Cron failed', name, errorDiagnostics(error));
                    outcome = 'error';
                    backendRecord('worker.failed');
                }
            },
        );
    } catch (error) {
        console.error('Cron dispatch failed', name, errorDiagnostics(error));
        outcome = 'error';
        backendRecord('worker.failed');
    } finally {
        finish?.(outcome);
    }
}

export async function checkReadOnly() {
    // Check if database is in read only mode. If so, skip running cronjobs.
    const [results] = await Database.select("SHOW VARIABLES LIKE 'read_only'");
    if (results.length !== 1) {
        console.error('UNEXPECTED RESULT FOR checking read only mode on the server.');
        console.error('Received', results);
    } else {
        const result = results[0]['session_variables'];
        if (!result) {
            console.error('UNEXPECTED RESULT FOR checking read only mode on the server.');
            console.error('Received', results);
        } else {
            const value = result['Value'];
            if (value !== 'ON' && value !== 'OFF') {
                console.error('UNEXPECTED RESULT FOR checking read only mode on the server.');
                console.error('Received', results);
            } else {
                if (value === 'ON') {
                    return true;
                }
            }
        }
    }
    return false;
}

let doStopCrons = false;
function stopCronScheduling() {
    doStopCrons = true;
}

let schedulingJobs = false;
function areCronsRunning(): string | false {
    for (const job of registeredCronJobs) {
        if (job.running) {
            return job.name || 'unknown';
        }
    }

    if (schedulingJobs && !doStopCrons) {
        return 'scheduling';
    }

    return false;
}

/** Schedule one pass. Launched handlers can outlive the pass; waitForCrons waits for them. */
export async function runCronJobs(options: { allowReadOnly: boolean; allowBeforeSeeds: boolean }) {
    if (STAMHOOFD.CRONS_DISABLED) {
        dispatch?.skip(registeredCronJobs.length);
        console.error(
            new StyledText('[CRONS] ').addClass('crons', 'tag'),
            new StyledText(
                'Crons are disabled. Make sure to enable them in the environment variables.',
            ).addClass('error'),
        );
        return;
    }

    if (!options.allowReadOnly && (await checkReadOnly())) {
        dispatch?.skip(registeredCronJobs.length);
        console.error(
            new StyledText('[CRONS] ').addClass('crons', 'tag'),
            new StyledText('MySQL is in read-only mode: crons are disabled.').addClass('error'),
        );
        return;
    }

    if (!options.allowBeforeSeeds && areSeedsNotFinished) {
        dispatch?.skip(registeredCronJobs.length);
        console.error(
            new StyledText('[CRONS] ').addClass('crons', 'tag'),
            new StyledText('Not all seeds are finished: crons are disabled.').addClass('error'),
        );
        return;
    }

    schedulingJobs = true;
    for (const [index, job] of registeredCronJobs.entries()) {
        if (doStopCrons) {
            dispatch?.skip(registeredCronJobs.length - index);
            break;
        }
        if (job.running) {
            dispatch?.skip();
            console.warn(job.name, 'is still running');
            continue;
        }
        job.running = true;
        run(job.name, job.method)
            .finally(() => {
                job.running = false;
            })
            .catch((e) => {
                job.running = false;
                console.error(e);
            });

        // Prevent starting too many jobs at once
        if (STAMHOOFD.environment !== 'development' && STAMHOOFD.environment !== 'test') {
            await sleep(10 * 1000);

            if (!options.allowReadOnly && (await checkReadOnly())) {
                dispatch?.skip(registeredCronJobs.length - index - 1);
                console.error(
                    new StyledText('[CRONS] ').addClass('crons', 'tag'),
                    new StyledText('MySQL is in read-only mode: crons are interrupted.').addClass(
                        'error',
                    ),
                );
                return;
            }
        }
    }
    schedulingJobs = false;
}

let cronInterval: NodeJS.Timeout | null = null;

export function startCrons(
    options: { allowReadOnly: boolean; allowBeforeSeeds: boolean } = {
        allowReadOnly: false,
        allowBeforeSeeds: false,
    },
) {
    if (registeredCronJobs.length === 0) {
        throw new Error('No crons registered');
    }

    if (STAMHOOFD.environment === 'test') {
        // Don't run crons in test mode (Playwright) - for now
        // Tests currently don't rely on them + in production these only run every 5 minutes
        return;
    }

    cronInterval = setInterval(
        () => {
            runCronJobs(options).catch(console.error);
        },
        STAMHOOFD.environment === 'development' ? 10 * 1000 : 5 * 60 * 1000,
    );
    runCronJobs(options).catch(console.error);
}

export function stopCrons() {
    stopCronScheduling();

    if (cronInterval) {
        clearInterval(cronInterval);
        cronInterval = null;
    }
}

export async function waitForCrons() {
    try {
        let running = areCronsRunning();
        while (running) {
            console.log('Crons are still running (' + running + '). Waiting 2 seconds...');
            await sleep(2000);
            running = areCronsRunning();
        }
    } catch (err) {
        console.error('Failed to wait for crons to finish:');
        console.error(err);
    }
}
