import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLFilter.js';
import { SQL } from '../../src/SQL.js';
import type { TableDefinition } from '../utils/index.js';
import { test, testError, testMatch } from '../utils/index.js';

/**
 * Dates are encoded as a unix timestamp in milliseconds inside JSON columns (see DateDecoder),
 * so they are stored as a JSON number, but compared with Date values.
 */
describe('JSON dates', () => {
    it('compares a date with the stored unix timestamp in milliseconds', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            'settings.date': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.date'), type: SQLValueType.JSONDate, nullable: false }),
        };

        await test({
            filter: {
                'settings.date': {
                    $gt: new Date(1749513600000),
                },
            },
            filters,
            query: {
                query: 'JSON_VALUE(`default`.`settings`,"$.date" RETURNING SIGNED NULL ON ERROR) > ?',
                params: [1749513600000],
            },
        });
    });

    it('cannot compare a date with a JSON string column', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            'settings.name': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.name'), type: SQLValueType.JSONString, nullable: false }),
        };

        await testError({
            filter: {
                'settings.name': {
                    $gt: new Date(1749513600000),
                },
            },
            filters,
            error: 'Cannot compare a date with a non-date column',
        });
    });

    it('cannot compare a string with a JSON date column', async () => {
        const filters = {
            ...baseSQLFilterCompilers,
            'settings.date': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.date'), type: SQLValueType.JSONDate, nullable: false }),
        };

        await testError({
            filter: {
                'settings.date': {
                    $gt: '2025-06-10',
                },
            },
            filters,
            error: 'Cannot compare a string with a non-string column',
        });
    });

    describe('MySQL Behaviour', () => {
        const tableDefinition: TableDefinition = {
            settings: {
                type: 'json',
                nullable: true,
            },
        };

        const filters = {
            ...baseSQLFilterCompilers,
            'settings.date': createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.date'), type: SQLValueType.JSONDate, nullable: true }),
        };

        // The stored date, and the day it falls on. These are built in UTC, because the timestamps end up
        // in the query parameters (and in the snapshots), which would otherwise depend on the local timezone.
        const stored = new Date(Date.UTC(2025, 5, 10, 14, 30, 15));
        const previousDay = new Date(Date.UTC(2025, 5, 9));
        const startOfDay = new Date(Date.UTC(2025, 5, 10));
        const endOfDay = new Date(Date.UTC(2025, 5, 10, 23, 59, 59, 999));
        const startOfNextDay = new Date(Date.UTC(2025, 5, 11));
        const endOfNextDay = new Date(Date.UTC(2025, 5, 11, 23, 59, 59, 999));

        const rows = [
            {
                settings: {
                    date: stored.getTime(),
                },
            },
        ];

        it('Matches a date on the same day, ignoring the time of day', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows,
                doMatch: [
                    // Equals, as built by the date filter in the UI
                    {
                        $and: [
                            { 'settings.date': { $gte: startOfDay } },
                            { 'settings.date': { $lte: endOfDay } },
                        ],
                    },
                ],
                doNotMatch: [
                    // Equals, but for another day
                    {
                        $and: [
                            { 'settings.date': { $gte: startOfNextDay } },
                            { 'settings.date': { $lte: endOfNextDay } },
                        ],
                    },
                    // Not equals, for the same day
                    {
                        $or: [
                            { 'settings.date': { $lt: startOfDay } },
                            { 'settings.date': { $gt: endOfDay } },
                        ],
                    },
                ],
            });
        });

        it('Compares dates chronologically', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows,
                doMatch: [
                    {
                        'settings.date': {
                            $gt: previousDay,
                        },
                    },
                    {
                        'settings.date': {
                            $lt: startOfNextDay,
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.date': {
                            $gt: endOfDay,
                        },
                    },
                    {
                        'settings.date': {
                            $lt: startOfDay,
                        },
                    },
                ],
            });
        });

        it('Matches null if the date is not set', async () => {
            await testMatch({
                tableDefinition,
                filters,
                rows: [
                    {
                        settings: {
                            date: null,
                        },
                    },
                    {
                        settings: null,
                    },
                    {
                        settings: {},
                    },
                ],
                doMatch: [
                    {
                        'settings.date': {
                            $eq: null,
                        },
                    },
                    // NULL values are always the smallest
                    {
                        'settings.date': {
                            $lt: startOfDay,
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings.date': {
                            $neq: null,
                        },
                    },
                    {
                        'settings.date': {
                            $gt: startOfDay,
                        },
                    },
                    // Equals, as built by the date filter in the UI
                    {
                        $and: [
                            { 'settings.date': { $gte: startOfDay } },
                            { 'settings.date': { $lte: endOfDay } },
                        ],
                    },
                ],
            });
        });
    });
});
