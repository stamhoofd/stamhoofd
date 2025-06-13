import { baseModernSQLFilterCompilers, createColumnFilter, createWildcardColumnFilter, SQLModernFilterDefinitions, SQLModernValueType } from '../../src/filters/modern/SQLModernFilter';
import { SQL } from '../../src/SQL';
import { test } from '../utils';

describe('Wildcards', () => {
    const filters: SQLModernFilterDefinitions = {
        ...baseModernSQLFilterCompilers,
        name: createColumnFilter({ expression: SQL.column('name'), type: SQLModernValueType.String, nullable: true }),
        age: createColumnFilter({ expression: SQL.column('age'), type: SQLModernValueType.Number, nullable: false }),
        settings: {
            ...baseModernSQLFilterCompilers,
            records: createWildcardColumnFilter(
                (key: string) => ({ expression: SQL.jsonValue(SQL.jsonValue(SQL.column('settings'), '$.records'), '$.' + key, true), type: SQLModernValueType.JSONObject, nullable: true }),
                (key: string) => ({
                    ...baseModernSQLFilterCompilers,
                    name: createColumnFilter({ expression: SQL.jsonValue(SQL.jsonValue(SQL.jsonValue(SQL.column('settings'), '$.records'), '$.' + key, true), '$.name'), type: SQLModernValueType.JSONString, nullable: true }),
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
                query: 'JSON_VALUE(JSON_EXTRACT(JSON_EXTRACT(`default`.`settings`,"$.records"),?),"$.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) = ?',
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
