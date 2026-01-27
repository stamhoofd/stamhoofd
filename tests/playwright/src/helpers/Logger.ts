import pino from 'pino';
import { WorkerData } from './worker/WorkerData';

const loggerBase = pino(
    {
        level: process.env.LOG_LEVEL ?? 'debug',
        timestamp: pino.stdTimeFunctions.isoTime,
        base: { pid: process.pid },
    },
    pino.destination({
        dest: 'playwright.log',
        sync: false, // async = faster, safe for Playwright
    }),
);

/**
 * Log messages to `playwright.log`.
 * Useful for debugging PlayWright tests.
 * Automatically logs the worker index.
 */
export class Logger {
    private static workerLogger = loggerBase.child({
        worker: WorkerData.id,
    });

    static info(text: string) {
        this.workerLogger.info(text);
    }
}
