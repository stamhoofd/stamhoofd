import mysql from 'mysql'

// create the connection to database
// Create the connection pool. The pool-specific settings are the defaults
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: 'stamhoofd',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

const debug = false

if (debug) {
    pool.on('acquire', function (connection) {
        console.log('Connection %d acquired', connection.threadId);
    });

    pool.on('connection', function (connection) {
        console.log('Connection %d created', connection.threadId);
    });

    pool.on('enqueue', function () {
        console.log('Waiting for available connection slot');
    });

    pool.on('release', function (connection) {
        console.log('Connection %d released', connection.threadId);
    });
}

/// Database is a wrapper arround mysql, because we want to use promises + types
export const Database = {
    async getConnection(): Promise<mysql.PoolConnection> {
        // Todo: use the settings here to provide a good connection pool
        return new Promise((resolve, reject) => {
            pool.getConnection((err, connection) => {
                if (err) {
                    console.error("connection failed")
                    return reject(err)
                }
                return resolve(connection)
            })
        });
    },

    async select(query: string, values?: any): Promise<[any[], mysql.FieldInfo[]]> {
        const connection = await this.getConnection();
        return new Promise((resolve, reject) => {
            const q = connection.query({ sql: query, nestTables: true, values: values }, (err, results, fields) => {
                connection.release();

                if (err) {
                    return reject(err)
                }
                return resolve([results, fields])
            })
            console.log(q.sql.replace(/\n+ +/g, '\n'))
        });
    },

    async insert(query: string, values?: any): Promise<[{ insertId: any }, mysql.FieldInfo[]]> {
        const connection = await this.getConnection();
        return new Promise((resolve, reject) => {
            const q = connection.query(query, values, (err, results, fields) => {
                connection.release();

                if (err) {
                    return reject(err)
                }
                return resolve([results, fields])
            })
            console.log(q.sql)
        });
    },

    async update(query: string, values?: any): Promise<[{ changedRows: number }, mysql.FieldInfo[]]> {
        const connection = await this.getConnection();
        return new Promise((resolve, reject) => {
            const q = connection.query(query, values, (err, results, fields) => {
                connection.release();

                if (err) {
                    return reject(err)
                }
                return resolve([results, fields])
            })
            console.log(q.sql)
        });
    },

    async delete(query: string, values?: any): Promise<[{ affectedRows: number }, mysql.FieldInfo[]]> {
        const connection = await this.getConnection();
        return new Promise((resolve, reject) => {
            const q = connection.query(query, values, (err, results, fields) => {
                connection.release();

                if (err) {
                    return reject(err)
                }
                return resolve([results, fields])
            })
            console.log(q.sql)
        });
    },

    async statement(query: string, values?: any): Promise<void> {
        const connection = await this.getConnection();
        return new Promise((resolve, reject) => {
            const q = connection.query(query, values, (err, results, fields) => {
                connection.release();

                if (err) {
                    return reject(err)
                }
                console.log("Statement result: ", results, fields);
                return resolve()
            })
            console.log(q.sql)

        });
    }
};