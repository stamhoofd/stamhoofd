import chalk from 'chalk';

import { Column, Database, DatabaseInstance, Migration } from '@simonbackx/simple-database';
import { Version } from '@stamhoofd/structures';
import path from 'path';

Column.setJSONVersion(Version);
process.env.TZ = 'UTC';

// Polyfill require.resolve, since import.meta.resolve is not supported by vitest
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

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

    // Reload database so we are sure we are running on the correct database in the
    // environment
    await Database.reload({})

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
    if (!await Migration.runAll(path.dirname(modelsPath) + '/migrations')) {
        throw new Error('Migrations failed')
    }
    if (!await Migration.runAll(path.dirname(emailPath) + '/../migrations')) {
        throw new Error('Email migrations failed')
    }

    // Internal
    if (!await Migration.runAll(import.meta.dirname + '/migrations')) {
        throw new Error('Internal migrations failed')
    }

    if (killSignalReceived) {
        console.error(chalk.red('Killing process due to received signal during migration'));
        process.exit(1);
    }

    // Reload database to prevent connection state leakage
    await Database.reload({})

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
