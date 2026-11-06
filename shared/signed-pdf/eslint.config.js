import stamhoofdEslint from 'eslint-plugin-stamhoofd';

export default [
    ...stamhoofdEslint.configs.shared,
    {
        // The signature check runs in the browser as well as in the backend, so nothing here may
        // reach for a Node built-in.
        files: ['src/**/*.ts'],
        rules: {
            'no-restricted-imports': ['error', {
                patterns: [{
                    group: ['node:*', 'fs', 'path', 'crypto', 'buffer', 'stream'],
                    message: 'This package also runs in the browser. Use WebCrypto and plain bytes instead.',
                }],
            }],
        },
    },
    {
        // Most tests assert through the `expectFailure` helper, which the rule cannot see into. It is
        // the assertion, so name it as one rather than adding a second one to every test.
        files: ['tests/**/*.ts'],
        rules: {
            'vitest/expect-expect': ['warn', { assertFunctionNames: ['expect', 'expectFailure', 'expectFailureWithMessage'] }],
        },
    },
];
