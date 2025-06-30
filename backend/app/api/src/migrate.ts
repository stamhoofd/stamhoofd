import chalk from 'chalk';

import { Column, DatabaseInstance, Migration } from '@simonbackx/simple-database';
import { Version } from '@stamhoofd/structures';
import path from 'path';

Column.setJSONVersion(Version);
process.env.TZ = 'UTC';

const emailPath = require.resolve('@stamhoofd/email');
const modelsPath = require.resolve('@stamhoofd/models');

// Validate UTC timezone
if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

const start = async () => {
    if (!STAMHOOFD.DB_DATABASE) {
        throw new Error('STAMHOOFD.DB_DATABASE is not set');
    }

    let killSignalReceived = false;
    const handler = () => {
        // Ignore
        console.error('Ignoring SIGTERM signal during migration');
        killSignalReceived = true;
    };

    process.on('SIGTERM', handler);
    process.on('SIGINT', handler);

    // Create database if not exists
    const query = 'CREATE DATABASE IF NOT EXISTS `' + STAMHOOFD.DB_DATABASE + '` DEFAULT CHARACTER SET = `utf8mb4` DEFAULT COLLATE = `utf8mb4_0900_ai_ci`';

    // Create a non-focused datbase instance to run the query without selecting a database
    const globalDatabase = new DatabaseInstance({
        database: null,
    });

    await globalDatabase.statement(query);

    // External migrations
    await Migration.runAll(path.dirname(modelsPath) + '/migrations');
    await Migration.runAll(path.dirname(emailPath) + '/migrations');

    // Internal
    await Migration.runAll(__dirname + '/src/migrations');

    if (killSignalReceived) {
        console.error(chalk.red('Killing process due to received signal during migration'));
        process.exit(1);
    }

    process.off('SIGTERM', handler);
    process.off('SIGINT', handler);
};

export async function run() {
    await start()
        .catch((error) => {
            console.error('unhandledRejection', error);
            process.exit(1);
        });
}
