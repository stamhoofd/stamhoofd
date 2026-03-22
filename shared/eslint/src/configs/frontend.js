import pluginVue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
    {
        languageOptions: {
            //sourceType: 'module',
            globals: {
                ...globals.browser,
            },
        },
    },
    ...pluginVue.configs['flat/recommended'].map(f => {
        return {
            ...f,
            files: ['*.ts', '**/*.ts', '*.vue', '**/*.vue'],
        }
    }),
    {
        files: ['*.ts', '**/*.ts', '*.vue', '**/*.vue'],
        languageOptions: {
            sourceType: 'module',
            parser: pluginVue.parser,
            parserOptions: {
                parser: tseslint.parser,
                projectService: true,
                extraFileExtensions: ['.vue'],
                logConfigResolution: true, // logs which tsconfig is used per file
            },
        },
    },
    {
        files: ['*.ts', '**/*.ts', '*.vue', '**/*.vue'],
        rules: {
            'vue/html-indent': ['warn', 4],
            'vue/html-button-has-type': 'error',
            'vue/no-mutating-props': 'off',
            'vue/max-attributes-per-line': 'off',
            'vue/block-order': [
                'error',
                {
                    order: ['template', 'script', 'style'],
                },
            ],
            'vue/no-unused-components': 'warn',
            'vue/no-multiple-template-root': 'off', // For some reason when you have html comments inside components, they are treated as root elements too, which cause unwanted bugs
            'vue/multi-word-component-names': 'off',
        },
    },
];
