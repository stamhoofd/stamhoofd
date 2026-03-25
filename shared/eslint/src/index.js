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

const baseRules = [
    ...defaultRules,
    regexpPlugin.configs.recommended,
    {
        settings: {
            'import/parsers': {
                '@typescript-eslint/parser': ['.ts', '.tsx'],
            },
            'import/resolver': {
                typescript: {
                    bun: false,
                },
            },
        },
    },
    eslint.configs.recommended,
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
        },
    },
    {
        files: ['**/*.js', '**/*.ts'],
        plugins: {
            '@stylistic': stylistic,
        },
        rules: {
            ...stylistic.configs.recommended,
            '@stylistic/quotes': ['error', 'single', { allowTemplateLiterals: true, avoidEscape: true }],
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
            'vitest/valid-expect': ['warn', {maxArgs: 2}] // Allow to pass a message by variable
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
    }
];

export default {
    configs: {
        base: baseRules,
        frontend: [
            ...baseRules,
            ...frontend,
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
