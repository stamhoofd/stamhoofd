import stamhoofdEslint from 'eslint-plugin-stamhoofd';

export default [
    ...stamhoofdEslint.configs.shared,
    {
        // Preserve the upstream API and validation expressions during integration.
        rules: {
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-unsafe-function-type': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-base-to-string': 'off',
            '@typescript-eslint/restrict-template-expressions': 'off',
            'regexp/prefer-w': 'off',
            'regexp/use-ignore-case': 'off',
        },
    },
];
