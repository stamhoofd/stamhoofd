import stamhoofdEslint from 'eslint-plugin-stamhoofd';

export default [
    ...stamhoofdEslint.configs.shared,
    {
        // Most tests assert through the `expectFailure` helper, which the rule cannot see into.
        files: ['tests/**/*.ts'],
        rules: {
            'vitest/expect-expect': ['warn', { assertFunctionNames: ['expect', 'expectFailure'] }],
        },
    },
];
