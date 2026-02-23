import { logger, StyledText } from '@simonbackx/simple-logging';
import { sleep } from '@stamhoofd/utility';

export type CronJobDefinition = {
    name: string;
    method: () => Promise<void>;
    running: boolean;
};

const registeredCronJobs: CronJobDefinition[] = [];

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
            }
            catch (e) {
                console.error(new StyledText(e).addClass('error'));
            }
        });
    }
    catch (e) {
        console.error(new StyledText(e).addClass('error'));
    }
}

let doStopCrons = false;
function stopCronScheduling() {
    doStopCrons = true;
}

let schedulingJobs = false;
function areCronsRunning(): boolean {
    if (schedulingJobs && !doStopCrons) {
        return true;
    }

    for (const job of registeredCronJobs) {
        if (job.running) {
            return true;
        }
    }
    return false;
}

async function crons() {
    if (STAMHOOFD.CRONS_DISABLED) {
        console.log('Crons are disabled. Make sure to enable them in the environment variables.');
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
        if (STAMHOOFD.environment !== 'development') {
            await sleep(10 * 1000);
        }
    }
    schedulingJobs = false;
};

let cronInterval: NodeJS.Timeout | null = null;

export function startCrons() {
    if (registeredCronJobs.length === 0) {
        throw new Error('No crons registered');
    }

    cronInterval = setInterval(() => {
        crons().catch(console.error);
    }, STAMHOOFD.environment === 'development' ? 10 * 1000 : 5 * 60 * 1000);
    crons().catch(console.error);
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
        while (areCronsRunning()) {
            console.log('Crons are still running. Waiting 2 seconds...');
            await sleep(2000);
        }
    }
    catch (err) {
        console.error('Failed to wait for crons to finish:');
        console.error(err);
    }
}
