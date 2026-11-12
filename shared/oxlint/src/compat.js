import { builtinRules } from 'eslint/use-at-your-own-risk';

// Use the maintained upstream rules where native Oxlint behavior is not equivalent.
export default {
    meta: { name: 'eslint-js' },
    rules: Object.fromEntries(['no-restricted-imports', 'no-dupe-args', 'no-octal', 'no-unsafe-optional-chaining'].map(name => [name, builtinRules.get(name)])),
};
