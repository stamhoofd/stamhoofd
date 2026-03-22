import stamhoofdEslint from 'eslint-plugin-stamhoofd';

export default [
    ...stamhoofdEslint.configs.shared,
    {
        rules: {
            '@typescript-eslint/no-unsafe-argument': 'off'
        }
    }
];
