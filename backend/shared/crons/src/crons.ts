import { Database } from '@simonbackx/simple-database';
import { logger, StyledText } from '@simonbackx/simple-logging';
import { sleep } from '@stamhoofd/utility';

export type CronJobDefinition = {
    name: string;
    method: () => Promise<void>;
    running: boolean;
};

const registeredCronJobs: CronJobDefinition[] = [];

let areSeedsNotFinished = true;

export function markAllSeedsFinished() {
    areSeedsNotFinished = false;
}

export function registerCron(name: string, method: () => Promise<void>) {
    registeredCronJobs.push({
        name,
        method,
        running: false,
    });
}

async function run(name: string, handler: () => Promise<void>) {
    try {
        await logger.setContext({
            prefixes: [
                new StyledText(`[${name}] `).addClass('crons', 'tag'),
            ],
            tags: ['crons'],
        }, async () => {
            try {
                await handler();
            } catch (e) {
                console.error(new StyledText(e).addClass('error'));
            }
        });
    } catch (e) {
        console.error(new StyledText(e).addClass('error'));
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

async function crons(options: { allowReadOnly: boolean; allowBeforeSeeds: boolean }) {
    if (STAMHOOFD.CRONS_DISABLED) {
        console.error(new StyledText(`[CRONS] `).addClass('crons', 'tag'), new StyledText('Crons are disabled. Make sure to enable them in the environment variables.').addClass('error'));
        return;
    }

    if (!options.allowReadOnly && await checkReadOnly()) {
        console.error(new StyledText(`[CRONS] `).addClass('crons', 'tag'), new StyledText('MySQL is in read-only mode: crons are disabled.').addClass('error'));
        return;
    }

    if (!options.allowBeforeSeeds && areSeedsNotFinished) {
        console.error(new StyledText(`[CRONS] `).addClass('crons', 'tag'), new StyledText('Not all seeds are finished: crons are disabled.').addClass('error'));
        return;
    }

    schedulingJobs = true;
    for (const job of registeredCronJobs) {
        if (doStopCrons) {
            break;
        }
        if (job.running) {
            console.warn(job.name, 'is still running');
            continue;
        }
        job.running = true;
        run(job.name, job.method).finally(() => {
            job.running = false;
        }).catch((e) => {
            job.running = false;
            console.error(e);
        });

        // Prevent starting too many jobs at once
        if (STAMHOOFD.environment !== 'development' && STAMHOOFD.environment !== 'test') {
            await sleep(10 * 1000);

            if (!options.allowReadOnly && await checkReadOnly()) {
                console.error(new StyledText(`[CRONS] `).addClass('crons', 'tag'), new StyledText('MySQL is in read-only mode: crons are interrupted.').addClass('error'));
                return;
            }
        }
    }
    schedulingJobs = false;
};

let cronInterval: NodeJS.Timeout | null = null;

export function startCrons(options: { allowReadOnly: boolean; allowBeforeSeeds: boolean } = { allowReadOnly: false, allowBeforeSeeds: false }) {
    if (registeredCronJobs.length === 0) {
        throw new Error('No crons registered');
    }

    if (STAMHOOFD.environment === 'test') {
        // Don't run crons in test mode (Playwright) - for now
        // Tests currently don't rely on them + in production these only run every 5 minutes
        return;
    }

    cronInterval = setInterval(() => {
        crons(options).catch(console.error);
    }, STAMHOOFD.environment === 'development' ? 10 * 1000 : 5 * 60 * 1000);
    crons(options).catch(console.error);
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
