import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { builtinRules } from 'eslint/use-at-your-own-risk';
import plugin from './index.js';

const rules = new Map(builtinRules);
for (const config of Object.values(plugin.configs).flat()) {
    for (const [namespace, plugin] of Object.entries(config.plugins ?? {})) {
        for (const [name, rule] of Object.entries(plugin.rules ?? {})) {
            rules.set(`${namespace}/${name}`, rule);
        }
    }
}

// ESLint's config hash does not include local plugin implementation changes.
const sourceDir = fileURLToPath(new URL('.', import.meta.url));
const hash = createHash('sha256');
for (const file of readdirSync(sourceDir, { recursive: true }).filter(file => file.endsWith('.js')).sort()) {
    hash.update(file).update(readFileSync(path.join(sourceDir, file)));
}
const version = hash.digest('hex');

/** Retain each file's formatting configuration without running semantic rules or loading TS projects. */
export function createFormattingESLint({ cwd, fix = false }) {
    return new ESLint({
        cwd,
        concurrency: 'off',
        fix,
        fixTypes: ['layout'],
        cache: true,
        cacheLocation: path.join(cwd, '.cache/eslint-format'),
        cacheStrategy: 'content',
        ruleFilter: ({ ruleId }) => rules.get(ruleId)?.meta?.type === 'layout',
        overrideConfig: {
            languageOptions: { parserOptions: { projectService: false, project: null } },
            linterOptions: { reportUnusedDisableDirectives: 'off' },
            settings: { stamhoofdFormatVersion: version },
        },
    });
}
