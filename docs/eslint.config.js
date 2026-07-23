import stamhoofdEslint from 'eslint-plugin-stamhoofd';

export default [
    ...stamhoofdEslint.configs.frontend,
    {
        // Nuxt generates .output/.nuxt; never lint build artifacts.
        ignores: ['.nuxt/**', '.output/**', '.data/**', 'content/**'],
    },
];
