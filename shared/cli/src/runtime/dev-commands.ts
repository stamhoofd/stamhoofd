import { join } from 'node:path';

/** Quotes one argument for the POSIX shell used by development commands. */
export function shellQuote(value: string): string {
    return `'${value.replaceAll("'", "'\\''")}'`;
}

export type BackendDevApp = 'api' | 'renderer' | 'stats';

/** Resolves a development executable independently of the application's working directory. */
export function devToolPath(
    rootDir: string,
    tool: 'supervise' | 'watch-typescript' | 'concurrently',
): string {
    return join(rootDir, 'packages/node/dev-tools/dist', `${tool}.js`);
}

/**
 * Runs compiler and runtime watchers in the backend package's working directory.
 * @param rootDir - Absolute repository root from the CLI context.
 * @param app - Backend owner selecting asset preparation and restart settings.
 * @returns POSIX shell command; a failed watcher terminates its sibling.
 * @remarks Shared dependencies must be built before launching. Only application-local
 * inputs and outputs depend on cwd; tooling and shared watch paths use rootDir.
 */
export function backendDevCommand(rootDir: string, app: BackendDevApp): string {
    const compile = `node ${shellQuote(devToolPath(rootDir, 'watch-typescript'))} ${app}`;
    const prepare =
        app === 'api'
            ? 'tsc --build tsconfig.build.json --clean && pnpm run copy-assets && '
            : app === 'stats'
              ? "mkdir -p ./dist/src/migrations && rsync --delete --exclude='*.ts' --exclude='*.js' --exclude='*.map' -r --checksum ./src/migrations/ ./dist/src/migrations/ && "
              : '';
    const watches = [
        'dist',
        join(rootDir, 'shared/*/dist/'),
        join(rootDir, 'backend/shared/*/dist/'),
    ];
    if (app === 'api')
        watches.push(
            join(rootDir, 'shared/*/package.json'),
            join(rootDir, 'backend/shared/*/package.json'),
        );
    else watches.push('.env.json');
    const execute = `node ${shellQuote(devToolPath(rootDir, 'supervise'))} ${app} node --enable-source-maps${app === 'api' ? ' --use-system-ca' : ''} ./dist/index.js`;
    const watchFlags = watches.map((path) => `--watch ${shellQuote(path)}`).join(' ');
    const extensions = app === 'api' ? '.ts,.json,.sql,.js,.html' : '.ts,.json,.sql,.js';
    const delay = app === 'api' ? 2000 : 1000;
    const runtime = `wait-on ./dist/index.js && nodemon --quiet ${watchFlags} --ext ${extensions} --delay ${delay}ms --exec ${shellQuote(execute)} --signal SIGTERM`;
    return `concurrently --raw --kill-others-on-fail ${shellQuote(prepare + compile)} ${shellQuote(runtime)}`;
}
