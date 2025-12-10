import { baseSQLFilterCompilers, createColumnFilter, SQLValueType } from '../../src/filters/SQLFilter';
import { SQL } from '../../src/SQL';
import { test, testError } from '../utils';

describe('Dot syntax', () => {
    const filters = {
        ...baseSQLFilterCompilers,
        name: createColumnFilter({ expression: SQL.column('name'), type: SQLValueType.String, nullable: true }),
        age: createColumnFilter({ expression: SQL.column('age'), type: SQLValueType.Number, nullable: false }),
        settings: {
            ...baseSQLFilterCompilers,
            name: createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.name'), type: SQLValueType.JSONString, nullable: true }),
            age: createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.age'), type: SQLValueType.JSONNumber, nullable: true }),
            dog: {
                ...baseSQLFilterCompilers,
                name: createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.dog.name'), type: SQLValueType.JSONString, nullable: true }),
                age: createColumnFilter({ expression: SQL.jsonExtract(SQL.column('settings'), '$.dog.age'), type: SQLValueType.JSONNumber, nullable: true }),
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
                query: 'JSON_VALUE(`default`.`settings`,"$.dog.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) <=> ?',
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
                query: 'JSON_VALUE(`default`.`settings`,"$.dog.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) <=> ?',
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
                query: 'JSON_VALUE(`default`.`settings`,"$.dog.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) <=> ?',
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
                query: 'JSON_VALUE(`default`.`settings`,"$.age" RETURNING UNSIGNED ERROR ON ERROR) <=> ? AND JSON_VALUE(`default`.`settings`,"$.dog.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) <=> ? AND JSON_VALUE(`default`.`settings`,"$.dog.age" RETURNING UNSIGNED ERROR ON ERROR) <=> ?',
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
                query: 'JSON_VALUE(`default`.`settings`,"$.age" RETURNING UNSIGNED ERROR ON ERROR) <=> ? AND JSON_VALUE(`default`.`settings`,"$.dog.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) <=> ? AND JSON_VALUE(`default`.`settings`,"$.dog.age" RETURNING UNSIGNED ERROR ON ERROR) <=> ?',
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
                query: 'JSON_VALUE(`default`.`settings`,"$.age" RETURNING UNSIGNED ERROR ON ERROR) <=> ? AND JSON_VALUE(`default`.`settings`,"$.dog.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) <=> ? AND JSON_VALUE(`default`.`settings`,"$.dog.age" RETURNING UNSIGNED ERROR ON ERROR) <=> ?',
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
                query: 'JSON_VALUE(`default`.`settings`,"$.age" RETURNING UNSIGNED ERROR ON ERROR) <=> ? OR JSON_VALUE(`default`.`settings`,"$.dog.name" RETURNING CHAR CHARACTER SET utf8mb4 ERROR ON ERROR) <=> ? OR JSON_VALUE(`default`.`settings`,"$.dog.age" RETURNING UNSIGNED ERROR ON ERROR) <=> ?',
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
