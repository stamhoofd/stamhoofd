import { baseModernSQLFilterCompilers, createColumnFilter, SQLModernValueType } from '../../src/filters/modern/SQLModernFilter';
import { SQL } from '../../src/SQL';
import { test, testError } from '../utils';

describe('Dot syntax', () => {
    const filters = {
        ...baseModernSQLFilterCompilers,
        name: createColumnFilter({ expression: SQL.column('name'), type: SQLModernValueType.String, nullable: true }),
        age: createColumnFilter({ expression: SQL.column('age'), type: SQLModernValueType.Number, nullable: false }),
        settings: {
            ...baseModernSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.jsonValue(SQL.column('settings'), '$.name'), type: SQLModernValueType.JSONString, nullable: true }),
            age: createColumnFilter({ expression: SQL.jsonValue(SQL.column('settings'), '$.age'), type: SQLModernValueType.JSONNumber, nullable: true }),
            dog: {
                ...baseModernSQLFilterCompilers,
                name: createColumnFilter({ expression: SQL.jsonValue(SQL.column('settings'), '$.dog.name'), type: SQLModernValueType.JSONString, nullable: true }),
                age: createColumnFilter({ expression: SQL.jsonValue(SQL.column('settings'), '$.dog.age'), type: SQLModernValueType.JSONNumber, nullable: true }),
            },
        },
    };

    it('Correctly finds the right filter when using object syntax', async () => {
        await test({
            filter: [
                {
                    settings: {
                        dog: {
                            name: 'Rex',
                        },
                    },
                },
            ],
            filters,
            query: {
                query: 'JSON_VALUE(`default`.`settings`,"$.dog.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) = ?',
                params: [
                    'rex',
                ],
            },
        });
    });

    it('Correctly finds the right filter when using dot syntax', async () => {
        await test({
            filter: [
                {
                    'settings.dog.name': {
                        $eq: 'Rex',
                    },
                },
            ],
            filters,
            query: {
                query: 'JSON_VALUE(`default`.`settings`,"$.dog.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) = ?',
                params: [
                    'rex',
                ],
            },
        });
    });

    it('Correctly finds the right filter when combining object with dot syntax', async () => {
        await test({
            filter: [
                {
                    settings: {
                        'dog.name': {
                            $eq: 'Rex',
                        },
                    },
                },
            ],
            filters,
            query: {
                query: 'JSON_VALUE(`default`.`settings`,"$.dog.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) = ?',
                params: [
                    'rex',
                ],
            },
        });
    });

    it('Can group with multiple syntax styles', async () => {
        await test({
            filter: [
                {
                    settings: {
                        'age': 12,
                        'dog.name': {
                            $eq: 'Rex',
                        },
                        'dog.age': {
                            $eq: 4,
                        },
                    },
                },
            ],
            filters,
            query: {
                query: 'JSON_VALUE(`default`.`settings`,"$.age" RETURNING UNSIGNED ERROR ON ERROR) = ? AND JSON_VALUE(`default`.`settings`,"$.dog.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) = ? AND JSON_VALUE(`default`.`settings`,"$.dog.age" RETURNING UNSIGNED ERROR ON ERROR) = ?',
                params: [
                    12,
                    'rex',
                    4,
                ],
            },
        });
    });

    it('Can group with object syntax styles', async () => {
        await test({
            filter: [
                {
                    settings: {
                        age: 12,
                        dog: {
                            name: 'Rex',
                            age: 4,
                        },
                    },
                },
            ],
            filters,
            query: {
                query: 'JSON_VALUE(`default`.`settings`,"$.age" RETURNING UNSIGNED ERROR ON ERROR) = ? AND JSON_VALUE(`default`.`settings`,"$.dog.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) = ? AND JSON_VALUE(`default`.`settings`,"$.dog.age" RETURNING UNSIGNED ERROR ON ERROR) = ?',
                params: [
                    12,
                    'rex',
                    4,
                ],
            },
        });
    });

    it('Can group with object syntax styles $and', async () => {
        await test({
            filter: [
                {
                    settings: [
                        {
                            age: 12,
                        },
                        {
                            dog: {
                                name: 'Rex',
                            },
                        },
                        {
                            dog: {
                                age: 4,
                            },
                        },
                    ],
                },
            ],
            filters,
            query: {
                query: 'JSON_VALUE(`default`.`settings`,"$.age" RETURNING UNSIGNED ERROR ON ERROR) = ? AND JSON_VALUE(`default`.`settings`,"$.dog.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) = ? AND JSON_VALUE(`default`.`settings`,"$.dog.age" RETURNING UNSIGNED ERROR ON ERROR) = ?',
                params: [
                    12,
                    'rex',
                    4,
                ],
            },
        });
    });

    it('Can group with object syntax styles $or', async () => {
        await test({
            filter: [
                {
                    settings: {
                        $or: [
                            {
                                age: 12,
                            },
                            {
                                dog: {
                                    name: 'Rex',
                                },
                            },
                            {
                                dog: {
                                    age: 4,
                                },
                            },
                        ],
                    },
                },
            ],
            filters,
            query: {
                query: 'JSON_VALUE(`default`.`settings`,"$.age" RETURNING UNSIGNED ERROR ON ERROR) = ? OR JSON_VALUE(`default`.`settings`,"$.dog.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) = ? OR JSON_VALUE(`default`.`settings`,"$.dog.age" RETURNING UNSIGNED ERROR ON ERROR) = ?',
                params: [
                    12,
                    'rex',
                    4,
                ],
            },
        });
    });

    it('Throw error for unknown subfilters', async () => {
        await testError({
            filter: [
                {
                    'settings.dot.name': {
                        $eq: 'Rex',
                    },
                },
            ],
            filters,
            error: 'Unknown filter dot.name',
        });
    });
});
