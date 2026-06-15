'use strict';
import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import importPlugin from 'eslint-plugin-import';
import tseslint from 'typescript-eslint';

// Configs
import vitest from '@vitest/eslint-plugin';
import regexpPlugin from 'eslint-plugin-regexp';
import defaultRules from './configs/default.js';
import frontend from './configs/frontend.js';
import node from './configs/node.js';
import typescript from './configs/typescript.js';
import asyncComponentWithProperties from './rules/async-component-with-properties.js';
import asyncRouteComponents from './rules/async-route-components.js';

const rules = {
    'async-component-with-properties': asyncComponentWithProperties,
    'async-route-components': asyncRouteComponents,
};
const stamhoofdPlugin = {
    rules,
};

const baseRules = [
    ...defaultRules,
    regexpPlugin.configs.recommended,
    {
        settings: {
            'import/parsers': {
                '@typescript-eslint/parser': ['.ts', '.tsx'],
                'vue-eslint-parser': ['.vue'],
            },
            'import/resolver': {
                typescript: {
                    bun: false,
                },
            },
        },
    },
    eslint.configs.recommended,
    {
        rules: {
            'preserve-caught-error': 'warn',
            'no-useless-assignment': 'warn',
        },
    },
    ...tseslint.configs.recommendedTypeChecked.map(config => ({
        ...config,
        files: ['*.ts', '**/*.ts', '*.vue', '**/*.vue'], // We use TS config only for TS files
    })),
    {
        files: ['*.ts', '**/*.ts', '*.vue', '**/*.vue'],
        languageOptions: {
            sourceType: 'module',
            parser: tseslint.parser,
            parserOptions: {
                projectService: true,
            },
        },
        ...typescript,
    },
    {
        plugins: {
            import: importPlugin,
        },
        rules: {
            'import/no-cycle': ['warn', { maxDepth: 100, ignoreExternal: false }],
            'import/no-extraneous-dependencies': ['error'],
            'import/no-relative-packages': 'error',
        },
    },

    stylistic.configs.customize({
        // the following options are the default values
        indent: 4,
        quotes: 'single',
        semi: true,
        jsx: false,
        severity: 'warn',
        braceStyle: '1tbs',
    }),
    {
        rules: {
            '@stylistic/quotes': ['warn', 'single', { allowTemplateLiterals: true, avoidEscape: true }],
        },
    },
    {
        // Make sure we disable TypeScript eslint rules that are not compatible with JavaScript files
        files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
        ...tseslint.configs.disableTypeChecked,
    },
    {
        files: ['**/*.cjs'],
        languageOptions: {
            sourceType: 'commonjs',
        },
    },
    {
        files: ['tests/**', '**/*.test.js', '**/*.test.ts'],
        plugins: { vitest },
        rules: {
            ...vitest.configs.recommended.rules,
            'vitest/no-conditional-expect': 'warn',
            'vitest/expect-expect': 'warn',
            'vitest/valid-expect': ['warn', { maxArgs: 2 }], // Allow to pass a message by variable
        },
    },

    {
        ignores: ['**/dist/*', '**/dist-*/*', '**/ios/*', '**/android/*'],
    },

    {
        // https://github.com/vitest-dev/vitest/issues/4543#issuecomment-1824628142
        files: ['**/*.test.js', '**/*.test.ts'],
        rules: {
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
        },
    },
];

export default {
    rules,
    configs: {
        base: baseRules,
        frontend: [
            ...baseRules,
            ...frontend,
            {
                plugins: {
                    stamhoofd: stamhoofdPlugin,
                },
                rules: {
                    'stamhoofd/async-component-with-properties': 'warn',
                    'stamhoofd/async-route-components': 'error',
                    // TODO: restore to 'error' once the existing dependency cycles are resolved.
                    'import/no-cycle': ['warn', { maxDepth: 100, ignoreExternal: false, allowUnsafeDynamicCyclicDependency: true }],
                    // Disallow importing from barrel files (index files that only re-export).
                    // Import directly from the source module instead, e.g. '#components/Foo.js'
                    // or '@stamhoofd/package-name/components/Bar' rather than a barrel.
                    'no-restricted-imports': ['error', {
                        // Bare package-root imports that resolve to a barrel index.ts.
                        // These packages expose subpath imports (e.g. '@stamhoofd/components/components/Foo'),
                        // which should be used instead of the barrel root.
                        paths: [
                            '@stamhoofd/components',
                            '@stamhoofd/frontend-excel-export',
                            '@stamhoofd/frontend-i18n',
                            '@stamhoofd/frontend-pdf-builder',
                            '@stamhoofd/networking',
                        ].map(name => ({
                            name,
                            message: 'Do not import from the barrel root. Import directly from the source module instead, e.g. \'' + name + '/organizations/Foo.vue\'.',
                        })),
                        // Explicit imports of an index file (e.g. '../models/index.js').
                        patterns: [{
                            regex: '(^|/)index(\\.(js|ts))?$',
                            message: 'Do not import from barrel files (index files). Import directly from the source module instead.',
                        }],
                    }],
                },
            },
        ],
        backend: [
            ...baseRules,
            ...node,
        ],
        shared: [
            ...baseRules,
            ...node,
        ],
    },
};
