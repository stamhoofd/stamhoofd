'use strict';
import tseslint from 'typescript-eslint';
import eslint from '@eslint/js';

// Configs
import frontend from './configs/frontend.js';
import typescript from './configs/typescript.js';
import defaultRules from './configs/default.js';

const baseRules = [
    eslint.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,  
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
        files: ['**/*.js', '**/*.mjs'],
        ...tseslint.configs.disableTypeChecked,
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
            ...baseRules
        ]
    },
};
