import { Column, Database } from '@simonbackx/simple-database';
import { I18n } from '@stamhoofd/backend-i18n/I18n';
import { startCrons, stopCrons, waitForCrons } from '@stamhoofd/crons';
import { loadLogger } from '@stamhoofd/logging';
import { Version } from '@stamhoofd/structures';
import { endStatisticsConnection } from './connection.js';

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
 * The sync reads models, whose structures reach for the global $t while they decode. There is no
 * request to take a language from here, so everything resolves in the platform default.
 */
function loadGlobalTranslateFunction() {
    function getI18n() {
        return I18n.override ?? new I18n(I18n.defaultLanguage, STAMHOOFD.fixedCountry ?? I18n.defaultCountry);
    }
    (global as any).$t = (key: string, replace?: Record<string, string>) => getI18n().$t(key, replace);
    (global as any).$getLanguage = () => getI18n().language;
    (global as any).$getCountry = () => getI18n().country;
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

    await I18n.load();
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

    await import('./crons.js');

    // This service runs no seeds of its own, and the sync writes, so a read-only replica has to
    // keep it switched off.
    startCrons({ allowReadOnly: false, allowBeforeSeeds: true });
};

start().catch((error) => {
    console.error('unhandledRejection', error);
    process.exit(1);
});
