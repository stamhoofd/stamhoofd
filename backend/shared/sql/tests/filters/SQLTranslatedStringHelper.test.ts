import { Language } from '@stamhoofd/structures';
import {
    baseSQLFilterCompilers,
    createColumnFilter,
    SQLValueType,
} from '../../src/filters/SQLFilter';
import { SQL } from '../../src/SQL';
import { SQLTranslatedStringHelper } from '../../src/SQLTranslatedStringHelper';
import { TableDefinition, testMatch } from '../utils';

type TranslatedStringValue = string | { [key in Language]?: string };

describe('SQLTranslatedStringHelper', () => {
    describe('MySQL behaviour', () => {
        const tableDefinition: TableDefinition = {
            settings: {
                type: 'json',
                nullable: true,
            },
        };

        const filters = {
            ...baseSQLFilterCompilers,
            'settings:name': createColumnFilter({
                expression: new SQLTranslatedStringHelper(
                    SQL.column('settings'),
                    '$.name',
                    () => Language.Dutch,
                ),
                type: SQLValueType.String,
                nullable: true,
            }),
        };

        it('Comparing string values is case insensitive', async () => {
            const rows: { settings: { name: TranslatedStringValue } }[] = [
                {
                    settings: {
                        name: { nl: 'alice', en: 'alice', fr: 'alice' },
                    },
                },
                {
                    settings: {
                        name: { nl: 'Alice', en: 'Alice', fr: 'Alice' },
                    },
                },
                {
                    settings: {
                        name: { nl: 'ALICE', en: 'ALICE', fr: 'ALICE' },
                    },
                },
            ];

            await testMatch({
                tableDefinition,
                filters,
                rows,
                doMatch: [
                    {
                        'settings:name': 'alice',
                    },
                    {
                        'settings:name': 'Alice',
                    },
                    {
                        'settings:name': 'ALICE',
                    },
                    {
                        'settings:name': 'alICe',
                    },
                ],
                doNotMatch: [
                    {
                        'settings:name': 'b',
                    },
                    {
                        'settings:name': 'alic',
                    },
                ],
            });
        });

        it('Filter matches both string and TranslatedString value', async () => {
            const rows: { settings: { name: TranslatedStringValue } }[] = [
                {
                    settings: {
                        name: { nl: 'alice', en: 'alice', fr: 'alice' },
                    },
                },
                {
                    settings: {
                        name: 'alice',
                    },
                },
                {
                    settings: {
                        name: 'ALICE',
                    },
                },
                {
                    settings: {
                        name: 'aliCE',
                    },
                },
            ];

            await testMatch({
                tableDefinition,
                filters,
                rows,
                doMatch: [
                    {
                        'settings:name': 'alice',
                    },
                    {
                        'settings:name': 'Alice',
                    },
                    {
                        'settings:name': 'ALICE',
                    },
                    {
                        'settings:name': 'alICe',
                    },
                ],
                doNotMatch: [
                    {
                        'settings:name': 'b',
                    },
                    {
                        'settings:name': 'alic',
                    },
                ],
            });
        });

        it('Filter on gt, gte, lt and lte works', async () => {
            const filters = {
                ...baseSQLFilterCompilers,
                'settings:name': createColumnFilter({
                    expression: new SQLTranslatedStringHelper(
                        SQL.column('settings'),
                        '$.name',
                        () => Language.Dutch,
                    ),
                    type: SQLValueType.String,
                    nullable: true,
                }),
            };

            const rows: { settings: { name: TranslatedStringValue } }[] = [
                {
                    settings: {
                        name: { nl: 'test b', en: 'test c', fr: 'test a' },
                    },
                },
                {
                    settings: {
                        name: 'test b',
                    },
                },
            ];

            await testMatch({
                tableDefinition,
                filters,
                rows,
                doMatch: [
                    {
                        'settings:name': {
                            $lt: 'test c',
                        },
                    },
                    {
                        'settings:name': {
                            $gt: 'test a',
                        },
                    },
                    {
                        'settings:name': {
                            $gte: 'test b',
                        },
                    },
                    {
                        'settings:name': {
                            $lte: 'test b',
                        },
                    },
                ],
                doNotMatch: [
                    {
                        'settings:name': {
                            $gt: 'test b',
                        },
                    },
                    {
                        'settings:name': {
                            $gt: 'test c',
                        },
                    },
                    {
                        'settings:name': {
                            $gte: 'test c',
                        },
                    },
                    {
                        'settings:name': {
                            $lt: 'test b',
                        },
                    },
                    {
                        'settings:name': {
                            $lt: 'test b',
                        },
                    },
                    {
                        'settings:name': {
                            $lt: 'test a',
                        },
                    },
                    {
                        'settings:name': {
                            $lte: 'test a',
                        },
                    },
                ],
            });
        });
    });

    describe('Different languages should select the correct value for comparison', () => {
        const tableDefinition: TableDefinition = {
            settings: {
                type: 'json',
                nullable: true,
            },
        };

        it('NL', async () => {
            const filters = {
                ...baseSQLFilterCompilers,
                'settings:name': createColumnFilter({
                    expression: new SQLTranslatedStringHelper(
                        SQL.column('settings'),
                        '$.name',
                        () => Language.Dutch,
                    ),
                    type: SQLValueType.String,
                    nullable: true,
                }),
            };

            const rows: { settings: { name: TranslatedStringValue } }[] = [
                {
                    settings: {
                        name: { nl: 'juist', en: 'fout', fr: 'fout' },
                    },
                },
                {
                    settings: {
                        name: 'juist',
                    },
                },
            ];

            await testMatch({
                tableDefinition,
                filters,
                rows,
                doMatch: [
                    {
                        'settings:name': 'juist',
                    },
                ],
                doNotMatch: [
                    {
                        'settings:name': 'fout',
                    },
                ],
            });
        });

        it('EN', async () => {
            const filters = {
                ...baseSQLFilterCompilers,
                'settings:name': createColumnFilter({
                    expression: new SQLTranslatedStringHelper(
                        SQL.column('settings'),
                        '$.name',
                        () => Language.English,
                    ),
                    type: SQLValueType.String,
                    nullable: true,
                }),
            };

            const rows: { settings: { name: TranslatedStringValue } }[] = [
                {
                    settings: {
                        name: { nl: 'fout', en: 'juist', fr: 'fout' },
                    },
                },
                {
                    settings: {
                        name: 'juist',
                    },
                },
            ];

            await testMatch({
                tableDefinition,
                filters,
                rows,
                doMatch: [
                    {
                        'settings:name': 'juist',
                    },
                ],
                doNotMatch: [
                    {
                        'settings:name': 'fout',
                    },
                ],
            });
        });

        it('FR', async () => {
            const filters = {
                ...baseSQLFilterCompilers,
                'settings:name': createColumnFilter({
                    expression: new SQLTranslatedStringHelper(
                        SQL.column('settings'),
                        '$.name',
                        () => Language.French,
                    ),
                    type: SQLValueType.String,
                    nullable: true,
                }),
            };

            const rows: { settings: { name: TranslatedStringValue } }[] = [
                {
                    settings: {
                        name: { nl: 'fout', en: 'fout', fr: 'juist' },
                    },
                },
                {
                    settings: {
                        name: 'juist',
                    },
                },
            ];

            await testMatch({
                tableDefinition,
                filters,
                rows,
                doMatch: [
                    {
                        'settings:name': 'juist',
                    },
                ],
                doNotMatch: [
                    {
                        'settings:name': 'fout',
                    },
                ],
            });
        });
    });

    describe('Missing language value should select the next language value in order for comparison', () => {
        const tableDefinition: TableDefinition = {
            settings: {
                type: 'json',
                nullable: true,
            },
        };

        it('NL', async () => {
            const filters = {
                ...baseSQLFilterCompilers,
                'settings:name': createColumnFilter({
                    expression: new SQLTranslatedStringHelper(
                        SQL.column('settings'),
                        '$.name',
                        () => Language.Dutch,
                    ),
                    type: SQLValueType.String,
                    nullable: true,
                }),
            };

            const rows: { settings: { name: TranslatedStringValue } }[] = [
                // first match english
                {
                    settings: {
                        name: { en: 'juist', fr: 'fout' },
                    },
                },
                // next match french
                {
                    settings: {
                        name: { fr: 'juist' },
                    },
                },
            ];

            await testMatch({
                tableDefinition,
                filters,
                rows,
                doMatch: [
                    {
                        'settings:name': 'juist',
                    },
                ],
                doNotMatch: [
                    {
                        'settings:name': 'fout',
                    },
                ],
            });
        });

        it('EN', async () => {
            const filters = {
                ...baseSQLFilterCompilers,
                'settings:name': createColumnFilter({
                    expression: new SQLTranslatedStringHelper(
                        SQL.column('settings'),
                        '$.name',
                        () => Language.English,
                    ),
                    type: SQLValueType.String,
                    nullable: true,
                }),
            };

            const rows: { settings: { name: TranslatedStringValue } }[] = [
                // first match dutch
                {
                    settings: {
                        name: { fr: 'fout', nl: 'juist' },
                    },
                },
                // next match french
                {
                    settings: {
                        name: { fr: 'juist' },
                    },
                },
            ];

            await testMatch({
                tableDefinition,
                filters,
                rows,
                doMatch: [
                    {
                        'settings:name': 'juist',
                    },
                ],
                doNotMatch: [
                    {
                        'settings:name': 'fout',
                    },
                ],
            });
        });

        it('FR', async () => {
            const filters = {
                ...baseSQLFilterCompilers,
                'settings:name': createColumnFilter({
                    expression: new SQLTranslatedStringHelper(
                        SQL.column('settings'),
                        '$.name',
                        () => Language.French,
                    ),
                    type: SQLValueType.String,
                    nullable: true,
                }),
            };

            const rows: { settings: { name: TranslatedStringValue } }[] = [
                // first match english
                {
                    settings: {
                        name: { nl: 'fout', en: 'juist' },
                    },
                },
                // next match dutch
                {
                    settings: {
                        name: { nl: 'juist' },
                    },
                },
            ];

            await testMatch({
                tableDefinition,
                filters,
                rows,
                doMatch: [
                    {
                        'settings:name': 'juist',
                    },
                ],
                doNotMatch: [
                    {
                        'settings:name': 'fout',
                    },
                ],
            });
        });
    });

    it('Empty json value should not match filter', async () => {
        const tableDefinition: TableDefinition = {
            settings: {
                type: 'json',
                nullable: true,
            },
        };

        const filters = {
            ...baseSQLFilterCompilers,
            'settings:name': createColumnFilter({
                expression: new SQLTranslatedStringHelper(
                    SQL.column('settings'),
                    '$.name',
                    () => Language.Dutch,
                ),
                type: SQLValueType.String,
                nullable: true,
            }),
        };

        const rows: { settings: { name: TranslatedStringValue } }[] = [
            // json value
            {
                settings: {
                    name: {},
                },
            },
        ];

        await testMatch({
            tableDefinition,
            filters,
            rows,
            doMatch: [
            ],
            doNotMatch: [
                {
                    'settings:name': '',
                },
                {
                    'settings:name': 'test',
                },
            ],
        });
    });
});
