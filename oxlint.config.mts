import eslint from 'eslint-plugin-stamhoofd';
import { createOxlintConfig } from 'oxlint-plugin-stamhoofd';
import { oxcOnlyIgnores } from './shared/eslint/src/ownership.js';

const config = await createOxlintConfig(eslint.configs.shared);
export default {
    ...config,
    options: { ...config.options, typeAware: true },
    ignorePatterns: [...config.ignorePatterns, ...oxcOnlyIgnores],
};
