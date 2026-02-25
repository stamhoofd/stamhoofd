'use strict';
import tseslint from 'typescript-eslint';
import eslint from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin'
import importPlugin from 'eslint-plugin-import';

// Configs
import frontend from './configs/frontend.js';
import typescript from './configs/typescript.js';
import defaultRules from './configs/default.js';
import jest from 'eslint-plugin-jest'
import node from './configs/node.js';
import globals from "globals";

const baseRules = [
    {
        settings: {
            "import/parsers": {
                "@typescript-eslint/parser": [".ts", ".tsx"],
            },
            'import/resolver': {
                typescript: {
                    bun: false
                },
            },
        },
    },
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,  
    {
        plugins: {
            'import': importPlugin
        },
        rules: {
            "import/no-unresolved": "error",
            'import/no-cycle': ["warn", { maxDepth: 100, ignoreExternal: false }],
        }
    },
    stylistic.configs.customize({
        // the following options are the default values
        indent: 4,
        quotes: 'single',
        semi: true,
        jsx: false
    }),
    {
        rules: {
            '@stylistic/quotes': ['error', 'single', { allowTemplateLiterals: true, avoidEscape: true }],
        }
    },
    {
        // Make sure TypeScript type checking can run correctly for rules that require it
        files: ['*.ts', '**/*.ts'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        }
    },    
    {
        ...defaultRules
    },
    {
        files: ['*.ts', '**/*.ts', '*.vue', '**/*.vue'],
        ...typescript
    },
    {
        // Make sure we disable TypeScript eslint rules that are not compatible with JavaScript files
        files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
        ...tseslint.configs.disableTypeChecked,
    },
    {
        files: ['**/*.cjs'],
        languageOptions: {
            sourceType: "commonjs"
        }
    },
    {
        files: ['**/*.test.js', '**/*.test.ts'],
        ...jest.configs['flat/recommended'],
        rules: {
            ...jest.configs['flat/recommended'].rules,
            'jest/prefer-expect-assertions': 'off',
        },
    },

    {
        ignores: ["**/dist/*"]
    }
];

export default {
    configs: {
        base: baseRules,
        frontend: [
            ...baseRules,
            ...frontend
        ],
        backend: [
            {
                languageOptions: {
                    globals: {
                        ...globals.node,
                    }
                }
            },
            ...baseRules,
            ...node
        ],
        shared: [
            ...baseRules,
            ...node
        ]
    },
};
