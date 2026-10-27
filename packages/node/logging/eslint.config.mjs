import stamhoofdEslint from 'eslint-plugin-stamhoofd';

export default [
    ...stamhoofdEslint.configs.backend,
    {
        files: ['src/logging.ts'],
        // Preserve upstream string coercion and console forwarding during integration.
        rules: {
            '@typescript-eslint/no-base-to-string': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
        },
    },
];
