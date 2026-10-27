import stamhoofdEslint from 'eslint-plugin-stamhoofd';

export default [
    ...stamhoofdEslint.configs.backend,
    {
        // Keep upstream endpoint contracts and request handling unchanged.
        rules: {
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            'no-prototype-builtins': 'off',
        },
    },
];
