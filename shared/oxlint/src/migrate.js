import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { builtinRules } from 'eslint/use-at-your-own-risk';
import migrate from '@oxlint/migrate';
import stamhoofd from 'eslint-plugin-stamhoofd';
import compat from './compat.js';

const eslintRequire = createRequire(import.meta.resolve('eslint-plugin-stamhoofd'));
const plugins = Object.assign({}, ...Object.values(stamhoofd.configs).flat().map(config => config.plugins));
const aliases = {
    'unicorn/no-unsafe-json-serialization': 'unicorn-js',
    'import/no-extraneous-dependencies': 'import-js',
    'import/no-relative-packages': 'import-js',
    'n/file-extension-in-import': 'node-js',
    'no-restricted-imports': 'eslint-js',
    'no-dupe-args': 'eslint-js',
    'no-octal': 'eslint-js',
    'no-unsafe-optional-chaining': 'eslint-js',
};
const extraPlugins = Object.fromEntries(Object.entries({ 'unicorn-js': plugins.unicorn, 'import-js': plugins.import, 'node-js': plugins.n, 'eslint-js': compat }).map(([name, plugin]) => [name, {
    ...plugin,
    meta: { ...plugin.meta, name: `eslint-plugin-${name}` },
}]));
const pluginPaths = {
    'unicorn-js': eslintRequire.resolve('eslint-plugin-unicorn'),
    'import-js': eslintRequire.resolve('eslint-plugin-import'),
    'node-js': eslintRequire.resolve('eslint-plugin-n'),
    'eslint-js': fileURLToPath(new URL('./compat.js', import.meta.url)),
};

/** Convert the owning ESLint policy, failing rather than silently omitting unsupported checks. */
export async function createOxlintConfig(configs) {
    const skipped = new Set();
    const source = configs.filter(config => config.name !== 'stamhoofd/oxc-ownership').map((config) => {
        const rules = {};
        for (const [id, value] of Object.entries(config.rules ?? {})) {
            const slash = id.lastIndexOf('/');
            const definition = slash < 0 ? builtinRules.get(id) : plugins[id.slice(0, slash)]?.rules?.[id.slice(slash + 1)];
            if (definition?.meta?.type === 'layout') continue;
            const alias = aliases[id];
            rules[alias ? `${alias}/${id.slice(slash + 1)}` : id] = value;
        }
        return { ...config, rules, plugins: { ...config.plugins, ...extraPlugins } };
    });
    const config = await migrate(source, undefined, {
        typeAware: true,
        withNursery: true,
        jsPlugins: true,
        reporter: {
            markSkipped: rule => skipped.add(rule),
            removeSkipped: rule => skipped.delete(rule),
            addWarning: () => {},
        },
    });
    if (skipped.size) throw new Error(`Oxlint cannot preserve these checks: ${[...skipped].join(', ')}`);
    const resolvePlugins = (entries = []) => entries.map((entry) => {
        const name = typeof entry === 'string' ? entry.replace(/^eslint-plugin-/, '') : entry.name;
        const specifier = typeof entry === 'string' ? entry : entry.specifier;
        return { name, specifier: pluginPaths[name] ?? eslintRequire.resolve(specifier) };
    });
    config.jsPlugins = resolvePlugins(config.jsPlugins);
    for (const override of config.overrides ?? []) {
        if (override.jsPlugins) override.jsPlugins = resolvePlugins(override.jsPlugins);
    }
    config.settings = Object.assign({}, ...configs.map(config => config.settings));
    // Type-aware options are root-only when Oxlint discovers nested package configs.
    delete config.options.typeAware;
    return config;
}
