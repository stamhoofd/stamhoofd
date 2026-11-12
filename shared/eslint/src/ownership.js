import { fileURLToPath } from 'node:url';

/** Whole packages that use Oxfmt/Oxlint instead of ESLint for source files. */
export const oxcPackages = [
    'backend/app/api',
    'backend/app/backup',
    'backend/app/redirecter',
    'backend/app/statistics-syncer',
    'backend/shared/crons',
    'backend/shared/email',
    'backend/shared/env',
    'backend/shared/i18n',
    'backend/shared/logging',
    'backend/shared/middleware',
    'backend/shared/models',
    'backend/shared/queues',
    'backend/shared/sql',
    'backend/shared/vies',
    'packages/common/errors',
    'packages/common/networking',
    'packages/common/opentelemetry-decorators',
    'packages/node/database',
    'packages/node/endpoints',
    'packages/node/logging',
    'packages/node/observability',
    'packages/node/opentelemetry-process',
    'packages/node/opentelemetry-terminal',
    'packages/node/terminal',
    'shared/cli',
    'shared/excel-writer',
    'shared/filters',
    'shared/metabase',
    'shared/sgv',
    'shared/stdsync',
    'shared/structures',
    'shared/test-utils',
    'shared/types',
    'shared/utility',
];

export const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
export const sourceExtensions = ['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts', 'vue'];
export const oxcOnlyIgnores = [
    ...sourceExtensions.map(extension => `**/*.${extension}`),
    ...oxcPackages.map(directory => `!${directory}/**`),
    '**/*.vue',
];

export const eslintOwnership = {
    name: 'stamhoofd/oxc-ownership',
    basePath: repositoryRoot,
    ignores: oxcPackages.map(directory => `${directory}/**`),
};
