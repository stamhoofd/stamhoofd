import { baseSQLFilterCompilers, createColumnFilter, createWildcardColumnFilter, SQLFilterDefinitions, SQLValueType } from '../../src/filters/SQLFilter.js';
import { SQL } from '../../src/SQL.js';
import { test } from '../utils/index.js';

describe('Wildcards', () => {
    const filters: SQLFilterDefinitions = {
        ...baseSQLFilterCompilers,
        name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: true }),
        age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
        settings: {
            ...baseSQLFilterCompilers,
            records: createWildcardColumnFilter(
                (key: string) => ({ expression: SQL.jsonExtract(SQL.jsonExtract(SQL.column('settings'), '$.records'), '$.' + key, true), type: SQLValueType.JSONObject, nullable: true }),
                (key: string) => ({
                    ...baseSQLFilterCompilers,
                    name: createColumnFilter({ expression: SQL.jsonExtract(SQL.jsonExtract(SQL.jsonExtract(SQL.column('settings'), '$.records'), '$.' + key, true), '$.name'), type: SQLValueType.JSONString, nullable: true }),
                }),
            ),
        },
    };

    it('Correctly finds the right filter when using object syntax', async () => {
        await test({
            filter: [
                {
                    settings: {
                        records: {
                            a: {
                                name: {
                                    $eq: 'Rex',
                                },
                            },
                        },
                    },
                },
            ],
            filters,
            query: {
                query: 'JSON_VALUE(JSON_EXTRACT(JSON_EXTRACT(`default`.`settings`,"$.records"),?),"$.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) <=> ?',
                params: [
                    '$.a',
                    'rex',
                ],
            },
        });
    });

    it('Can support this', async () => {
        await test({
            filter: [
                {
                    settings: {
                        records: {
                            a: {
                                $neq: null,
                            },
                        },
                    },
                },
            ],
            filters,
            query: {
                query: 'JSON_VALUE(JSON_EXTRACT(`default`.`settings`,"$.records"),? ERROR ON ERROR) IS NOT NULL',
                params: [
                    '$.a',
                ],
            },
        });
    });
});
