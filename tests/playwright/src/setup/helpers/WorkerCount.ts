import os from 'node:os';

/**
 * How many Playwright workers this run uses.
 *
 * The global setup reserves exactly this many slots (ports + domains), so the number Playwright
 * runs with has to be the same number: it is read here and passed to Playwright through the
 * `workers` config option, instead of letting Playwright fall back to its own default.
 */
export function getWorkerCount(): number {
    const configured = process.env.PLAYWRIGHT_WORKER_COUNT ? Number.parseInt(process.env.PLAYWRIGHT_WORKER_COUNT, 10) : undefined;
    if (configured !== undefined && Number.isFinite(configured) && configured > 0) {
        return configured;
    }

    if (process.env.CI) {
        return 2;
    }

    return Math.max(1, Math.floor(os.availableParallelism() / 2));
}
