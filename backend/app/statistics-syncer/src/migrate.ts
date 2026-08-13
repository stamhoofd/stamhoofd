import { Column } from '@simonbackx/simple-database';
import { Version } from '@stamhoofd/structures';
import { endStatisticsConnection } from './database.js';
import { runStatisticsMigrations } from './schema.js';

Column.setJSONVersion(Version);
process.env.TZ = 'UTC';

if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

const start = async () => {
    let killSignalReceived = false;
    const handler = () => {
        console.error('Ignoring kill signal during migration');
        killSignalReceived = true;
    };

    process.on('SIGTERM', handler);
    process.on('SIGINT', handler);

    try {
        await runStatisticsMigrations();

        if (killSignalReceived) {
            console.error('Killing process due to received signal during migration');
            process.exit(1);
        }
    } finally {
        process.off('SIGTERM', handler);
        process.off('SIGINT', handler);

        // These migrations run on the statistics database only: the main one is never connected to.
        await endStatisticsConnection();
    }
};

export async function run() {
    await start().catch((error) => {
        console.error('unhandledRejection', error);
        process.exit(1);
    });
}
