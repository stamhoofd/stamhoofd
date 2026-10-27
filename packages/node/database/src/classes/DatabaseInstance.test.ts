import { Database, DatabaseInstance } from './Database.js';

describe('DatabaseInstance.use', () => {
    // An instance without a default database: 'SELECT DATABASE()' tells the two apart.
    let other: DatabaseInstance;

    beforeAll(() => {
        other = new DatabaseInstance({ database: null });
    });

    afterAll(async () => {
        await other.end();
    });

    async function getSelectedDatabase(): Promise<string | null> {
        const [rows] = await Database.select('SELECT DATABASE() as name', [], { nestTables: false });
        return rows[0].name as string | null;
    }

    test('Queries run on the default instance outside of a use() call', async () => {
        expect(Database.instance).toBe(DatabaseInstance.default);
        expect(await getSelectedDatabase()).toEqual(process.env.DB_DATABASE);
    });

    test('Queries run on the provided instance inside a use() call', async () => {
        await DatabaseInstance.use(other, async () => {
            expect(Database.instance).toBe(other);
            expect(await getSelectedDatabase()).toBeNull();
        });
    });

    test('Restores the previous instance when the method returns', async () => {
        await DatabaseInstance.use(other, () => Promise.resolve());

        expect(Database.instance).toBe(DatabaseInstance.default);
        expect(await getSelectedDatabase()).toEqual(process.env.DB_DATABASE);
    });

    test('Restores the previous instance when the method throws', async () => {
        const error = new Error('Something went wrong inside the use call');

        await expect(
            DatabaseInstance.use(other, () => {
                throw error;
            }),
        ).rejects.toThrow(error);

        expect(Database.instance).toBe(DatabaseInstance.default);
        expect(await getSelectedDatabase()).toEqual(process.env.DB_DATABASE);
    });

    test('Returns the value returned by the method', async () => {
        expect(await DatabaseInstance.use(other, () => Promise.resolve(42))).toEqual(42);
    });

    test('Nested use() calls restore the instance of the enclosing one', async () => {
        const nested = new DatabaseInstance({ database: null });

        try {
            await DatabaseInstance.use(other, async () => {
                await DatabaseInstance.use(nested, () => {
                    expect(Database.instance).toBe(nested);
                    return Promise.resolve();
                });

                expect(Database.instance).toBe(other);
                expect(await getSelectedDatabase()).toBeNull();
            });
        }
        finally {
            await nested.end();
        }
    });

    test('Concurrent contexts each keep their own instance', async () => {
        const insideResults: (string | null)[] = [];
        const outsideResults: (string | null)[] = [];

        await Promise.all([
            DatabaseInstance.use(other, async () => {
                for (let i = 0; i < 5; i++) {
                    insideResults.push(await getSelectedDatabase());
                }
            }),
            (async () => {
                for (let i = 0; i < 5; i++) {
                    outsideResults.push(await getSelectedDatabase());
                }
            })(),
        ]);

        expect(insideResults).toEqual([null, null, null, null, null]);
        expect(outsideResults).toEqual(new Array(5).fill(process.env.DB_DATABASE));
    });

    test('A transaction inside a use() call runs on the provided instance', async () => {
        await DatabaseInstance.use(other, async () => {
            await Database.beginTransaction(async () => {
                expect(other.getTransactionConnection()).toBeDefined();
                expect(DatabaseInstance.default.getTransactionConnection()).toBeUndefined();
                expect(await getSelectedDatabase()).toBeNull();
            });
        });

        expect(other.getTransactionConnection()).toBeUndefined();
    });

    test('Database forwards its members to the instance of the current context', async () => {
        expect(Database.pool).toBe(DatabaseInstance.default.pool);
        expect(Database.escapeId('someColumn')).toEqual('`someColumn`');

        await DatabaseInstance.use(other, () => {
            expect(Database.pool).toBe(other.pool);
            return Promise.resolve();
        });
    });
});
