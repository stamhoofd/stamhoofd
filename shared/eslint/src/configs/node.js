import nodePlugin from 'eslint-plugin-n';
import globals from 'globals';

export default [
    {
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    {
        plugins: {
            n: nodePlugin,
        },
        rules: {
            'n/file-extension-in-import': [
                'error',
                'always',
            ],
        },
    },
    {
        files: ['**/*.d.ts'],
        rules: {
            'n/file-extension-in-import': 'off',
        },
    },
];
