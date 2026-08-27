import { Column, Database } from '@simonbackx/simple-database';
import { startCrons, stopCrons, waitForCrons } from '@stamhoofd/crons';
import { loadLogger } from '@stamhoofd/logging';
import { Version } from '@stamhoofd/structures';
import { endStatisticsConnection } from './database.js';
import { statisticsLanguage } from './rows.js';

process.on('unhandledRejection', (error: Error) => {
    console.error('unhandledRejection');
    console.error(error.message, error.stack);
    process.exit(1);
});

// Set version of saved structures
Column.setJSONVersion(Version);

// Set timezone to UTC
process.env.TZ = 'UTC';

// Quick check
if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

/**
 * The sync reads models, whose structures reach for the global $t while they decode. Nothing it
 * writes is translated — rows.ts resolves every name it writes itself, never through a structure
 * getter that runs $t — so returning the key is enough to keep decoding from throwing, and this
 * service needs no locales of its own.
 */
function loadGlobalTranslateFunction() {
    (global as any).$t = (key: string) => key;
    (global as any).$getLanguage = () => statisticsLanguage;
    (global as any).$getCountry = () => 'BE';
}

const shutdown = async () => {
    console.log('Shutting down...');
    stopCrons();
    await waitForCrons();

    try {
        await endStatisticsConnection();
        await Database.end();
    } catch (error) {
        console.error('Failed to close the database connections:');
        console.error(error);
    }

    process.exit(0);
};

const start = async () => {
    console.log('Started Statistics.');
    loadLogger();

    loadGlobalTranslateFunction();

    process.on('SIGTERM', () => {
        console.info('SIGTERM signal received.');
        shutdown().catch((error) => {
            console.error(error);
            process.exit(1);
        });
    });

    process.on('SIGINT', () => {
        console.info('SIGINT signal received.');
        shutdown().catch((error) => {
            console.error(error);
            process.exit(1);
        });
    });

    const { statisticsCronOptions } = await import('./crons.js');

    // This service runs no seeds of its own.
    startCrons(statisticsCronOptions);
};

start().catch((error) => {
    console.error('unhandledRejection', error);
    process.exit(1);
});
