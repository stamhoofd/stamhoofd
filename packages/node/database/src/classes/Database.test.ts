import { Database } from './Database.js';

describe('Database.beginTransaction', () => {
    // Counter to generate unique names so tests don't interfere with each other.
    let nameCounter = 0;
    function uniqueName(): string {
        nameCounter += 1;
        return `tx-test-${Date.now()}-${nameCounter}`;
    }

    async function insertModel(name: string, options?: { connection?: any }) {
        await Database.insert(
            'INSERT INTO testModels (name, count, isActive, createdOn, testDecoder) VALUES (?, ?, ?, ?, ?)',
            [name, 1, 1, new Date(), JSON.stringify({ id: 12 })],
            options?.connection,
        );
    }

    async function countModels(name: string): Promise<number> {
        const [rows] = await Database.select('SELECT * from testModels where name = ?', [name]);
        return rows.length;
    }

    async function getCount(name: string, options?: { connection?: any }): Promise<number | undefined> {
        const [rows] = await Database.select(
            'SELECT count from testModels where name = ?',
            [name],
            { connection: options?.connection, nestTables: false },
        );
        return rows[0]?.count as number | undefined;
    }

    async function updateCount(name: string, count: number, useConnection?: any) {
        await Database.update(
            'UPDATE testModels SET count = ? where name = ?',
            [count, name],
            useConnection,
        );
    }

    async function deleteModel(name: string, useConnection?: any) {
        await Database.delete('DELETE FROM testModels where name = ?', [name], useConnection);
    }

    test('Commits the changes when the method returns without throwing', async () => {
        const name = uniqueName();

        await Database.beginTransaction(async () => {
            await insertModel(name);
        });

        expect(await countModels(name)).toEqual(1);

        await Database.delete('DELETE FROM testModels where name = ?', [name]);
    });

    test('Commits an update query when the method returns without throwing', async () => {
        const name = uniqueName();
        await insertModel(name);

        await Database.beginTransaction(async () => {
            await updateCount(name, 5);
        });

        expect(await getCount(name)).toEqual(5);

        await Database.delete('DELETE FROM testModels where name = ?', [name]);
    });

    test('Rolls back an update query and rethrows when the method throws', async () => {
        const name = uniqueName();
        await insertModel(name);
        const error = new Error('Something went wrong inside the transaction');

        await expect(
            Database.beginTransaction(async () => {
                await updateCount(name, 5);
                throw error;
            }),
        ).rejects.toThrow(error);

        // The update must have been rolled back to its original value
        expect(await getCount(name)).toEqual(1);

        await Database.delete('DELETE FROM testModels where name = ?', [name]);
    });

    test('An update inside the transaction runs on the transaction connection', async () => {
        const name = uniqueName();
        await insertModel(name);

        await Database.beginTransaction(async () => {
            await updateCount(name, 5);

            // The same connection should see its own uncommitted update
            expect(await getCount(name)).toEqual(5);

            // A separate connection (outside the transaction) must NOT see the uncommitted update
            const outsideConnection = await Database.getConnection();
            try {
                expect(await getCount(name, { connection: outsideConnection })).toEqual(1);
            }
            finally {
                outsideConnection.release();
            }
        });

        // After commit the update is visible everywhere
        expect(await getCount(name)).toEqual(5);

        await Database.delete('DELETE FROM testModels where name = ?', [name]);
    });

    test('An explicitly passed connection takes precedence over the transaction connection for updates', async () => {
        const name = uniqueName();
        await insertModel(name);
        const explicitConnection = await Database.getConnection();

        try {
            await expect(
                Database.beginTransaction(async () => {
                    // This update runs on the explicit connection (auto-commit), not the transaction
                    await updateCount(name, 5, explicitConnection);
                    throw new Error('Roll back the transaction');
                }),
            ).rejects.toThrow();

            // The transaction was rolled back, but the explicit-connection update was committed independently
            expect(await getCount(name)).toEqual(5);
        }
        finally {
            explicitConnection.release();
        }

        await Database.delete('DELETE FROM testModels where name = ?', [name]);
    });

    test('Commits a delete query when the method returns without throwing', async () => {
        const name = uniqueName();
        await insertModel(name);

        await Database.beginTransaction(async () => {
            await deleteModel(name);
        });

        expect(await countModels(name)).toEqual(0);
    });

    test('Rolls back a delete query and rethrows when the method throws', async () => {
        const name = uniqueName();
        await insertModel(name);
        const error = new Error('Something went wrong inside the transaction');

        await expect(
            Database.beginTransaction(async () => {
                await deleteModel(name);
                throw error;
            }),
        ).rejects.toThrow(error);

        // The delete must have been rolled back, so the model still exists
        expect(await countModels(name)).toEqual(1);

        await Database.delete('DELETE FROM testModels where name = ?', [name]);
    });

    test('A delete inside the transaction runs on the transaction connection', async () => {
        const name = uniqueName();
        await insertModel(name);

        await Database.beginTransaction(async () => {
            await deleteModel(name);

            // The same connection should see its own uncommitted delete
            expect(await countModels(name)).toEqual(0);

            // A separate connection (outside the transaction) must still see the row
            const outsideConnection = await Database.getConnection();
            try {
                const [outsideRows] = await Database.select(
                    'SELECT * from testModels where name = ?',
                    [name],
                    { connection: outsideConnection, nestTables: true },
                );
                expect(outsideRows).toHaveLength(1);
            }
            finally {
                outsideConnection.release();
            }
        });

        // After commit the delete is visible everywhere
        expect(await countModels(name)).toEqual(0);
    });

    test('An explicitly passed connection takes precedence over the transaction connection for deletes', async () => {
        const name = uniqueName();
        await insertModel(name);
        const explicitConnection = await Database.getConnection();

        try {
            await expect(
                Database.beginTransaction(async () => {
                    // This delete runs on the explicit connection (auto-commit), not the transaction
                    await deleteModel(name, explicitConnection);
                    throw new Error('Roll back the transaction');
                }),
            ).rejects.toThrow();

            // The transaction was rolled back, but the explicit-connection delete was committed independently
            expect(await countModels(name)).toEqual(0);
        }
        finally {
            explicitConnection.release();
        }
    });

    test('Rolls back the changes and rethrows when the method throws', async () => {
        const name = uniqueName();
        const error = new Error('Something went wrong inside the transaction');

        await expect(
            Database.beginTransaction(async () => {
                await insertModel(name);
                throw error;
            }),
        ).rejects.toThrow(error);

        // The insert must have been rolled back
        expect(await countModels(name)).toEqual(0);
    });

    test('Returns the value returned by the transaction method', async () => {
        const result = await Database.beginTransaction(async () => {
            return Promise.resolve(42);
        });

        expect(result).toEqual(42);
    });

    test('Binds the transaction connection to the current async context', async () => {
        expect(Database.getTransactionConnection()).toBeUndefined();

        await Database.beginTransaction(async () => {
            expect(Database.getTransactionConnection()).toBeDefined();
            return Promise.resolve();
        });

        // The connection should no longer be available once the transaction finished
        expect(Database.getTransactionConnection()).toBeUndefined();
    });

    test('Queries inside the transaction run on the transaction connection', async () => {
        const name = uniqueName();

        await Database.beginTransaction(async () => {
            await insertModel(name);

            // The same connection should see its own uncommitted insert
            expect(await countModels(name)).toEqual(1);

            // A separate connection (outside the transaction) must NOT see the uncommitted insert
            const outsideConnection = await Database.getConnection();
            try {
                const [outsideRows] = await Database.select(
                    'SELECT * from testModels where name = ?',
                    [name],
                    { connection: outsideConnection, nestTables: true },
                );
                expect(outsideRows).toHaveLength(0);
            }
            finally {
                outsideConnection.release();
            }
        });

        await Database.delete('DELETE FROM testModels where name = ?', [name]);
    });

    test('An explicitly passed connection takes precedence over the transaction connection', async () => {
        const name = uniqueName();
        const explicitConnection = await Database.getConnection();

        try {
            await expect(
                Database.beginTransaction(async () => {
                    // This insert runs on the explicit connection (auto-commit), not the transaction
                    await insertModel(name, { connection: explicitConnection });
                    throw new Error('Roll back the transaction');
                }),
            ).rejects.toThrow();

            // The transaction was rolled back, but the explicit-connection insert was committed independently
            expect(await countModels(name)).toEqual(1);
        }
        finally {
            explicitConnection.release();
        }

        await Database.delete('DELETE FROM testModels where name = ?', [name]);
    });

    test('Queries outside of a transaction use a pool connection', async () => {
        expect(Database.getTransactionConnection()).toBeUndefined();

        const name = uniqueName();
        await insertModel(name);
        expect(await countModels(name)).toEqual(1);

        await Database.delete('DELETE FROM testModels where name = ?', [name]);
    });

    test('Releases the connection back to the pool on commit and on rollback', async () => {
        // The default connection limit is 10. If connections were leaked, running more
        // transactions than that sequentially would exhaust the pool and hang.
        for (let i = 0; i < 25; i++) {
            await Database.beginTransaction(async () => {
                await Database.select('SELECT 1 as v');
            });
        }

        for (let i = 0; i < 25; i++) {
            await expect(
                Database.beginTransaction(async () => {
                    await Database.select('SELECT 1 as v');
                    throw new Error('rollback');
                }),
            ).rejects.toThrow('rollback');
        }
    });
});
