import fs from 'fs';
import { AsyncLocalStorage } from 'async_hooks';
import mysql from 'mysql2/promise';
import type {DatabaseStoredValue} from './DatabaseStoredValue.js';
export type SQLResultRow = Record<string, DatabaseStoredValue>;
export type SQLResultNamespacedRow = Record<string, SQLResultRow>;

type SelectOptions = { connection?: mysql.PoolConnection; nestTables?: boolean };
export type PoolOptions = {
    debug?: boolean;
    host?: string;
    user?: string;
    password?: string;
    port?: number;
    database?: string | null; // set to null to not use a default database
    connectionLimit?: number;
    multipleStatements?: boolean;
    charset?: string;
    useSSL?: boolean;
    /** Path to the CA certificate file */
    ca?: string;
    /** Path to the client private key file (for mutual TLS) */
    key?: string;
    /** Path to the client certificate file (for mutual TLS) */
    cert?: string;
};

/// Database is a wrapper arround mysql, because we want to use promises + types
export class DatabaseInstance {
    pool: mysql.Pool;
    debug = false;

    /// Holds the connection of the transaction that is currently running for the active async context (if any).
    private transactionStorage = new AsyncLocalStorage<mysql.PoolConnection>();

    /// Holds the instance that replaces the default one for the active async context (if any).
    private static instanceStorage = new AsyncLocalStorage<DatabaseInstance>();
    private static defaultInstance: DatabaseInstance | undefined;

    constructor(options: PoolOptions = {}) {
        this.createPool(options);
    }

    /// The instance that queries run on when they don't receive one: the instance of the enclosing
    /// use() call, or the default instance.
    static get current(): DatabaseInstance {
        return DatabaseInstance.instanceStorage.getStore() ?? DatabaseInstance.default;
    }

    /// The instance built from the environment variables. Only created once something uses it, so a
    /// service that talks to another database doesn't need a default one configured.
    static get default(): DatabaseInstance {
        DatabaseInstance.defaultInstance ??= new DatabaseInstance();
        return DatabaseInstance.defaultInstance;
    }

    /// Runs the provided method on the given instance: every query inside it that doesn't receive an
    /// explicit connection runs on that instance instead of the default one.
    static async use<T>(instance: DatabaseInstance, handler: () => Promise<T>): Promise<T> {
        return await DatabaseInstance.instanceStorage.run(instance, handler);
    }

    createPool(options: PoolOptions = {}) {
        const settings = {
            host: options.host ?? process.env.DB_HOST ?? 'localhost',
            user: options.user ?? process.env.DB_USER ?? 'root',
            password: options.password ?? process.env.DB_PASS ?? 'root',
            port: options.port ? options.port : parseInt(process.env.DB_PORT ?? '3306'),
            database: options.database === undefined ? process.env.DB_DATABASE : options.database,
            connectionLimit: options.connectionLimit ? options.connectionLimit : parseInt(process.env.DB_CONNECTION_LIMIT ?? '10'),
            multipleStatements: options.multipleStatements ?? ((process.env.DB_MULTIPLE_STATEMENTS ?? 'true') === 'true'),
            charset: options.charset ?? process.env.DB_CHARSET ?? 'utf8mb4_0900_ai_ci',
            useSSL: options.useSSL ?? !!process.env.DB_USE_SSL,
            ca: options.ca ?? process.env.DB_CA,
            key: options.key ?? process.env.DB_KEY,
            cert: options.cert ?? process.env.DB_CERT,
        };

        if (settings.database === undefined) {
            throw new Error('Environment variable DB_DATABASE is missing');
        }

        this.pool = mysql.createPool({
            host: settings.host,
            user: settings.user,
            password: settings.password,
            port: settings.port,
            database: settings.database ?? undefined,
            waitForConnections: true,
            connectionLimit: settings.connectionLimit,
            queueLimit: 0,
            multipleStatements: settings.multipleStatements,
            charset: settings.charset,
            decimalNumbers: true,
            jsonStrings: true,
            ssl: settings.useSSL
                ? {
                        ca: settings.ca ? fs.readFileSync(settings.ca) : undefined,
                        key: settings.key ? fs.readFileSync(settings.key) : undefined,
                        cert: settings.cert ? fs.readFileSync(settings.cert) : undefined,
                        rejectUnauthorized: settings.ca ? true : false,
                    }
                : undefined,
        });
        this.debug = options?.debug ?? false;

        if (this.debug) {
            this.pool.on('acquire', function (connection) {
                console.log('Connection %d acquired', connection.threadId);
            });

            this.pool.on('connection', function (connection) {
                console.log('Connection %d created', connection.threadId);
            });

            this.pool.on('enqueue', function () {
                console.log('Waiting for available connection slot');
            });

            this.pool.on('release', function (connection) {
                console.log('Connection %d released', connection.threadId);
            });
        }
    }

    async reload(options: PoolOptions = {}): Promise<void> {
        await this.pool.end();
        this.createPool(options);
    }

    setDebug(enabled = true) {
        this.debug = enabled;
    }

    async getConnection(): Promise<mysql.PoolConnection> {
        // Todo: use the settings here to provide a good connection pool
        return await this.pool.getConnection();
    }

    /// Returns the connection of the transaction that is running in the current async context, if any.
    getTransactionConnection(): mysql.PoolConnection | undefined {
        return this.transactionStorage.getStore();
    }

    /// Runs the provided method inside a database transaction. Every query that runs inside the method
    /// (and that doesn't receive an explicit connection) automatically uses the transaction connection.
    /// The transaction is committed when the method returns, or rolled back when it throws.
    async beginTransaction<T>(transaction: () => Promise<T>): Promise<T> {
        const connection = await this.getConnection();
        try {
            await connection.beginTransaction();

            let result: T;
            try {
                result = await this.transactionStorage.run(connection, transaction);
            }
            catch (error) {
                try {
                    await connection.rollback();
                } catch (e) {
                    console.error('Failed to rollback transaction', e);
                }
                throw error;
            }

            await connection.commit();
            return result;
        }
        finally {
            connection.release();
        }
    }

    escapeId(value: string): string {
        return this.pool.escapeId(value);
    }

    async end(): Promise<void> {
        return await this.pool.end();
    }

    startQuery(): [number, number] {
        return process.hrtime();
    }

    logQuery(q, hrstart: [number, number]) {
        if (this.debug) {
            const hrend = process.hrtime(hrstart);
            console.warn(q.sql.replace(/\n+ +/g, '\n'), 'started at ' + (hrend[0] * 1000 + hrend[1] / 1000000) + 'ms');
        }
    }

    finishQuery(q, hrstart: [number, number]) {
        if (this.debug) {
            const hrend = process.hrtime(hrstart);
            console.log(q.sql.replace(/\s+/g, ' '), 'in ' + (hrend[0] * 1000 + hrend[1] / 1000000) + 'ms');
        }
    }

    select(query: string, values?: any, options?: SelectOptions & { nestTables: true }): Promise<[SQLResultNamespacedRow[], mysql.FieldPacket[] | undefined]>;
    select(query: string, values?: any, options?: SelectOptions & { nestTables: false }): Promise<[SQLResultRow[], mysql.FieldPacket[] | undefined]>;
    async select(query: string, values?: any, options: SelectOptions = {}): Promise<[(SQLResultNamespacedRow | SQLResultRow)[], mysql.FieldPacket[] | undefined]> {
        const explicitConnection = options.connection ?? this.getTransactionConnection();
        const connection: mysql.PoolConnection = explicitConnection ?? (await this.getConnection());
        try {
            const q = await connection.query({ sql: query, nestTables: options.nestTables ?? true, values: values });
            return [
                q[0] as (SQLResultNamespacedRow | SQLResultRow)[],
                q[1] as mysql.FieldPacket[] | undefined,
            ];
        }
        finally {
            if (!explicitConnection) {
                connection.release();
            }
        }
    }

    async insert(
        query: string,
        values?: any,
        useConnection?: mysql.PoolConnection,
    ): Promise<[{ insertId: any; affectedRows: number }, mysql.FieldPacket[] | undefined]> {
        const explicitConnection = useConnection ?? this.getTransactionConnection();
        const connection: mysql.PoolConnection = explicitConnection ?? (await this.getConnection());
        try {
            const q = await connection.query({ sql: query, values: values });
            return [
                q[0] as { insertId: any; affectedRows: number },
                q[1] as mysql.FieldPacket[] | undefined,
            ];
        }
        finally {
            if (!explicitConnection) {
                connection.release();
            }
        }
    }

    async update(query: string, values?: any, useConnection?: mysql.PoolConnection): Promise<[
        { /** @deprecated */ changedRows: number; affectedRows: number }
        , mysql.FieldPacket[] | undefined]> {
        const explicitConnection = useConnection ?? this.getTransactionConnection();
        const connection: mysql.PoolConnection = explicitConnection ?? (await this.getConnection());
        try {
            const q = await connection.query({ sql: query, values: values });
            return [
                q[0] as { changedRows: number; affectedRows: number },
                q[1] as mysql.FieldPacket[] | undefined,
            ];
        }
        finally {
            if (!explicitConnection) {
                connection.release();
            }
        }
    }

    async delete(query: string, values?: any, useConnection?: mysql.PoolConnection): Promise<[{ affectedRows: number }, mysql.FieldPacket[] | undefined]> {
        const explicitConnection = useConnection ?? this.getTransactionConnection();
        const connection: mysql.PoolConnection = explicitConnection ?? (await this.getConnection());
        try {
            const q = await connection.query({ sql: query, values: values });
            return [
                q[0] as { affectedRows: number },
                q[1] as mysql.FieldPacket[] | undefined,
            ];
        }
        finally {
            if (!explicitConnection) {
                connection.release();
            }
        }
    }

    async statement(query: string, values?: any, useConnection?: mysql.PoolConnection): Promise<[any, any]> {
        const explicitConnection = useConnection ?? this.getTransactionConnection();
        const connection: mysql.PoolConnection = explicitConnection ?? (await this.getConnection());
        try {
            const q = await connection.query({ sql: query, values: values });
            return [
                q[0] as any,
                q[1] as any,
            ];
        }
        finally {
            if (!explicitConnection) {
                connection.release();
            }
        }
    }
}

export type DatabaseProxy = DatabaseInstance & {
    /// The instance the queries of the current async context run on.
    readonly instance: DatabaseInstance;
};

/**
 * The database of the current async context, as set by DatabaseInstance.use() - the default instance
 * outside of it.
 *
 * Reading a member off this object (Database.select, Database.pool, ...) resolves it on that instance
 * every time. That only exists to keep the calls that were written against the old singleton working:
 * write Database.instance.select(...) in new code, so the instance the query runs on is visible where
 * the query is.
 */
export const Database: DatabaseProxy = new Proxy({} as DatabaseProxy, {
    get(_target, property) {
        const current = DatabaseInstance.current;
        if (property === 'instance') {
            return current;
        }

        const value = Reflect.get(current, property, current) as unknown;
        return typeof value === 'function' ? value.bind(current) : value;
    },
    set(_target, property, value) {
        return Reflect.set(DatabaseInstance.current, property, value);
    },
    has(_target, property) {
        return property === 'instance' || Reflect.has(DatabaseInstance.current, property);
    },
});
