import stamhoofdEslint from 'eslint-plugin-stamhoofd';

export default [
    ...stamhoofdEslint.configs.frontend,
    {
        // Retain upstream Vue internals, public types and expressions during integration.
        files: ['src/**/*.{ts,vue}'],
        rules: {
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-base-to-string': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-unused-expressions': 'off',
            'prefer-const': 'off',
            'prefer-rest-params': 'off',
        },
    },
    {
        files: ['index.ts'],
        rules: {
            'no-restricted-imports': 'off',
        },
    },
];
