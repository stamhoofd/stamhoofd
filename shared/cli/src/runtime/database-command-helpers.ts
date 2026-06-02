import { input, select } from '@inquirer/prompts';
import { buildBackendEnv } from '../config/build-config.js';
import { localIpv4Host, mysqlContainer, mysqlRootPassword, mysqlRootUser } from '../config/shared-service-config.js';
import * as docker from '../services/docker.js';
import type { BaseCommand } from '../base-command.js';

type CommandContext = Awaited<ReturnType<BaseCommand['createContext']>>;

export function currentDatabase(context: CommandContext): string {
    return buildBackendEnv(context).DB_DATABASE ?? 'stamhoofd-development';
}

export async function listDatabases(): Promise<string[]> {
    const result = await docker.run(['exec', mysqlContainer, 'mysql', `-h${localIpv4Host}`, `-u${mysqlRootUser}`, `-p${mysqlRootPassword}`, '-N', '-B', '-e', 'SHOW DATABASES;'], { capture: true });
    return result.stdout
        .split('\n')
        .map(database => database.trim())
        .filter(database => database.length > 0);
}

const customDatabaseValue = '__stamhoofd_custom_database__';

export async function resolveDatabaseOption(options: { flag: string | undefined; message: string; current: string; includeCurrent: boolean; customInput?: boolean }): Promise<string> {
    if (options.flag) {
        return options.flag;
    }

    const databases = await listDatabases();
    const choices = options.includeCurrent && !databases.includes(options.current)
        ? [...databases, options.current]
        : databases;

    if (choices.length === 0) {
        throw new Error('No local MySQL databases found. Pass a database name explicitly.');
    }

    const selected = await select({
        message: options.message,
        choices: [
            ...choices.map(database => ({
                name: database === options.current ? `${database} (current setup)` : database,
                value: database,
            })),
            ...(options.customInput ? [{ name: 'Enter a custom database name...', value: customDatabaseValue }] : []),
        ],
    });

    if (selected !== customDatabaseValue) {
        return selected;
    }

    return await input({
        message: 'Enter the target database name',
        validate: value => value.trim().length > 0 || 'Enter a database name.',
    });
}

export async function createDatabase(database: string): Promise<void> {
    await runMysqlStatement(`CREATE DATABASE IF NOT EXISTS ${escapeIdentifier(database)} CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;`);
}

export async function dropDatabase(database: string): Promise<void> {
    await runMysqlStatement(`DROP DATABASE IF EXISTS ${escapeIdentifier(database)};`);
}

export async function copyDatabase(from: string, to: string): Promise<void> {
    await createDatabase(to);
    await docker.run(['exec', mysqlContainer, 'sh', '-c', `mysqldump -h${shellQuote(localIpv4Host)} -u${shellQuote(mysqlRootUser)} -p${shellQuote(mysqlRootPassword)} --single-transaction --routines --triggers --events ${shellQuote(from)} | mysql -h${shellQuote(localIpv4Host)} -u${shellQuote(mysqlRootUser)} -p${shellQuote(mysqlRootPassword)} ${shellQuote(to)}`]);
}

function runMysqlStatement(statement: string): Promise<void> {
    return docker.run(['exec', mysqlContainer, 'mysql', `-h${localIpv4Host}`, `-u${mysqlRootUser}`, `-p${mysqlRootPassword}`, '-e', statement]);
}

function escapeIdentifier(identifier: string): string {
    return `\`${identifier.replaceAll('`', '``')}\``;
}

function shellQuote(value: string): string {
    return `'${value.replaceAll("'", `'"'"'`)}'`;
}
