import { logger } from '@simonbackx/simple-logging';
import { AsyncLocalStorage } from 'node:async_hooks';

export async function withMigrationOutput(run: () => Promise<void>, verbose: boolean): Promise<void> {
    if (verbose) {
        await run();
        return;
    }

    const scope = new AsyncLocalStorage<boolean>();
    const stdout = logger.stdout;
    const stderr = logger.stderr;
    let output = '';
    const flush = () => {
        if (output) {
            stdout.write(output);
            output = '';
        }
    };

    // SSO setup runs concurrently; its logs must not be buffered with the migrations.
    logger.stdout = {
        write: (message) => {
            if (scope.getStore()) {
                output += message;
            }
            else {
                stdout.write(message);
            }
        },
        clearLine: direction => stdout.clearLine(direction),
    };
    logger.stderr = {
        write: (message) => {
            if (scope.getStore()) {
                flush();
            }
            stderr.write(message);
        },
        clearLine: direction => stderr.clearLine(direction),
    };

    try {
        await scope.run(true, run);
    }
    catch (error) {
        flush();
        throw error;
    }
    finally {
        logger.stdout = stdout;
        logger.stderr = stderr;
    }
}
