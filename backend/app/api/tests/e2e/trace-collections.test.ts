import { Database } from '@node/database';
import { attachApplication } from '@node/dev-tools/application';
import { openDevEventChannel } from '@node/dev-tools/channel';
import { isDevSpan, subscribeDevSpans } from '@node/dev-tools/spans';
import { initializeTelemetry, traceEndpoint } from '@node/observability';
import { Invoice, Member } from '@stamhoofd/models';
import {
    SQL,
    compileToSQLFilter,
    createColumnFilter,
    createJoinedRelationFilter,
    SQLValueType,
} from '@stamhoofd/sql';

it('ships only verified model targets on their own statement in concurrent local requests', async () => {
    const session = await openDevEventChannel(() => {}, undefined, '*');
    for (const [key, value] of Object.entries(session.env)) vi.stubEnv(key, value);
    vi.stubEnv('STAM_DEV_APP', 'api');
    const subscriber = subscribeDevSpans(session.env.STAM_DEV_SESSION);
    const detach = attachApplication('api');
    const runtime = initializeTelemetry('api', { ownsMetrics: false });
    try {
        await Promise.all(
            (
                [
                    ['GET', Invoice],
                    ['POST', Member],
                ] as const
            ).map(([method, model]) =>
                traceEndpoint({}, method, async () => {
                    await model.select().limit(1).count();
                    await SQL.select().from('invoices', 'canary_alias').count();
                    await SQL.select()
                        .from('invoices', 'canary_left')
                        .join(SQL.join(SQL.table('users', 'canary_right')).where('id', 'absent'))
                        .count();
                    const source =
                        method === 'GET'
                            ? SQL.table('organizations', 'canary_filter')
                            : SQL.jsonTable(SQL.scalar('["absent"]'), 'canary_filter').addColumn(
                                  'id',
                                  'VARCHAR',
                                  '$',
                              );
                    const join = SQL.leftJoin(source).where(
                        SQL.column('id'),
                        SQL.parentColumn('organizationId'),
                    );
                    const filter = await compileToSQLFilter(
                        { relation: { id: 'absent' } },
                        new Map([
                            [
                                'relation',
                                createJoinedRelationFilter(
                                    join,
                                    new Map([
                                        [
                                            'id',
                                            createColumnFilter({
                                                expression: SQL.column('id'),
                                                type: SQLValueType.String,
                                                nullable: false,
                                            }),
                                        ],
                                    ]),
                                ),
                            ],
                        ]),
                    );
                    await Invoice.select()
                        .join(SQL.leftJoin('users', 'canary_explicit').where('id', 'absent'))
                        .where(filter)
                        .count();
                    await Database.select('SELECT ? AS canary_column', ['canary-bind']);
                    return { status: 200 };
                }),
            ),
        );
        await detach();
        const trees = subscriber.snapshot();
        expect(trees).toHaveLength(2);
        for (const tree of trees) {
            const root = tree.find((s) => !s.parentId)!;
            const statements = tree.filter((s) => s.name === 'mysql.execute');
            expect(statements.map((s) => s.collection)).toEqual([
                root.method === 'GET' ? 'invoices' : 'members',
                'invoices',
                undefined,
                undefined,
                undefined,
            ]);
            expect(statements[3].collections).toEqual(
                root.method === 'GET' ? ['invoices', 'users', 'organizations'] : undefined,
            );
            expect(statements[2].collections).toEqual(['invoices', 'users']);
            expect(isDevSpan({ ...statements[2], collections: ['users', 'canary_alias'] })).toBe(
                false,
            );
            expect(
                isDevSpan({
                    ...statements[2],
                    collections: ['users', 'invoices', 'tokens', 'webshops', 'members'],
                }),
            ).toBe(false);
            expect(
                tree
                    .filter((s) => s.name === 'mysql.acquire')
                    .every((s) => s.collection === undefined),
            ).toBe(true);
            expect(isDevSpan({ ...statements[0], collection: 'canary_identifier' })).toBe(false);
            expect(isDevSpan({ ...statements[0], name: 'mysql.acquire' })).toBe(false);
            expect(JSON.stringify(tree)).not.toContain('canary');
        }
    } finally {
        await runtime.shutdown();
        await detach();
        await session.close();
        vi.unstubAllEnvs();
    }
});
