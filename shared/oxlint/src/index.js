import eslint from 'eslint-plugin-stamhoofd';
import { createOxlintConfig } from './migrate.js';

export { createOxlintConfig };

// Inherited repository/backend configs anchor tests/** above package directories.
// Only the recursive test-file patterns apply inside these packages.
const inherited = configs => configs.map(config => config.files
    ? {
            ...config,
            files: config.files.filter(pattern => pattern !== 'tests/**'),
        }
    : config);

export const configs = {
    shared: await createOxlintConfig(inherited(eslint.configs.shared)),
    backend: await createOxlintConfig(inherited(eslint.configs.backend)),
};
