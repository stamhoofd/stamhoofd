import stamhoofdEslint from 'eslint-plugin-stamhoofd';

export default [
    ...stamhoofdEslint.configs.shared,
    // This package must stay usable from both @stamhoofd/structures and @stamhoofd/sql, so it cannot import any internal package.
    {
        rules: {
            'no-restricted-imports': ['error', {
                patterns: ['@stamhoofd/*'],
            }],
        },
    },
];
