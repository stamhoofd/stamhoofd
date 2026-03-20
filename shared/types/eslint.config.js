import stamhoofdEslint from 'eslint-plugin-stamhoofd';

export default [
    ...stamhoofdEslint.configs.shared,
    // Disable importing. This package should have ZERO dependencies
    {
        rules: {
            'no-restricted-imports': ['error', {
                patterns: ['@stamhoofd/*'],
            }],
        },
    },
];
