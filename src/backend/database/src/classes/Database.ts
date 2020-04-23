import mysql from "mysql";

// create the connection to database
// Create the connection pool. The pool-specific settings are the defaults
const pool = mysql.createPool({
    host: "localhost",
    user: "root",
    password: "root",
    database: "stamhoofd",
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const debug = false;

if (debug) {
    pool.on("acquire", function (connection) {
        console.log("Connection %d acquired", connection.threadId);
    });

    pool.on("connection", function (connection) {
        console.log("Connection %d created", connection.threadId);
    });

    pool.on("enqueue", function () {
        console.log("Waiting for available connection slot");
    });

    pool.on("release", function (connection) {
        console.log("Connection %d released", connection.threadId);
    });
}

/// Database is a wrapper arround mysql, because we want to use promises + types
export const Database = {
    async getConnection(): Promise<mysql.PoolConnection> {
        // Todo: use the settings here to provide a good connection pool
        return new Promise((resolve, reject) => {
            pool.getConnection((err, connection) => {
                if (err) {
                    console.error("connection failed");
                    return reject(err);
                }
                return resolve(connection);
            });
        });
    },

    async end(): Promise<mysql.MysqlError | undefined> {
        return new Promise((resolve, reject) => {
            pool.end(function (err) {
                if (err) {
                    console.error(err);
                    return reject(err);
                }

                if (debug) {
                    console.log("All connections have ended in the pool");
                }
                return resolve();
            });
        });
    },

    startQuery(): [number, number] {
        return process.hrtime();
    },

    logQuery(_q, _hrstart: [number, number]) {
        //const hrend = process.hrtime(hrstart)
        //console.log(q.sql.replace(/\n+ +/g, '\n'), "started at " + (hrend[0] * 1000 + hrend[1] / 1000000) + "ms")
    },

    finishQuery(q, hrstart: [number, number]) {
        //const hrend = process.hrtime(hrstart);
        //console.log(q.sql.replace(/\s+/g, " "), "in " + (hrend[0] * 1000 + hrend[1] / 1000000) + "ms");
    },

    async select(query: string, values?: any): Promise<[any[], mysql.FieldInfo[]]> {
        const connection = await this.getConnection();
        return new Promise((resolve, reject) => {
            const hrstart = this.startQuery();
            const q = connection.query({ sql: query, nestTables: true, values: values }, (err, results, fields) => {
                connection.release();

                this.finishQuery(q, hrstart);

                if (err) {
                    return reject(err);
                }

                return resolve([results, fields]);
            });
            this.logQuery(q, hrstart);
        });
    },

    async insert(query: string, values?: any): Promise<[{ insertId: any; affectedRows: number }, mysql.FieldInfo[]]> {
        const connection = await this.getConnection();
        return new Promise((resolve, reject) => {
            const hrstart = this.startQuery();
            const q = connection.query(query, values, (err, results, fields) => {
                connection.release();

                this.finishQuery(q, hrstart);

                if (err) {
                    return reject(err);
                }
                return resolve([results, fields]);
            });
            this.logQuery(q, hrstart);
        });
    },

    async update(query: string, values?: any): Promise<[{ changedRows: number }, mysql.FieldInfo[]]> {
        const connection = await this.getConnection();
        return new Promise((resolve, reject) => {
            const hrstart = this.startQuery();
            const q = connection.query(query, values, (err, results, fields) => {
                connection.release();

                this.finishQuery(q, hrstart);

                if (err) {
                    return reject(err);
                }
                return resolve([results, fields]);
            });
            this.logQuery(q, hrstart);
        });
    },

    async delete(query: string, values?: any): Promise<[{ affectedRows: number }, mysql.FieldInfo[]]> {
        const connection = await this.getConnection();
        return new Promise((resolve, reject) => {
            const hrstart = this.startQuery();
            const q = connection.query(query, values, (err, results, fields) => {
                connection.release();

                this.finishQuery(q, hrstart);

                if (err) {
                    return reject(err);
                }
                return resolve([results, fields]);
            });
            this.logQuery(q, hrstart);
        });
    },

    async statement(query: string, values?: any): Promise<[any, any]> {
        const connection = await this.getConnection();
        return new Promise((resolve, reject) => {
            const hrstart = this.startQuery();
            const q = connection.query(query, values, (err, results, fields) => {
                connection.release();

                this.finishQuery(q, hrstart);

                if (err) {
                    return reject(err);
                }
                return resolve([results, fields]);
            });
            this.logQuery(q, hrstart);
        });
    }
};
