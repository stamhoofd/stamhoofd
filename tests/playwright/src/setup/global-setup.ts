import { TestUtils } from '@stamhoofd/test-utils';
import { CaddyHelper } from './helpers/CaddyHelper.js';
import { DatabaseHelper } from './helpers/DatabaseHelper.js';
import { FrontendBuilder } from './helpers/FrontendBuilder.js';
import { PlaywrightHooks } from './helpers/PlaywrightHooks.js';
import { SsoHelper } from './helpers/SsoHelper.js';
import { getWorkerCount } from './helpers/WorkerCount.js';

// Make sure initial env is loaded

TestUtils.globalSetup(new PlaywrightHooks());

export default async function globalSetup() {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error(
            'Global setup should not run if not in test environment',
        );
    }

    const frontendBuilder = new FrontendBuilder();
    const caddyHelper = new CaddyHelper();

    // The SSO server is only reachable once its Caddy route is in place, so it starts after the
    // routes are configured. Runs next to the frontend build, which takes far longer.
    const configureCaddyAndStartSso = async () => {
        const workerCount = getWorkerCount();
        if (!await caddyHelper.isRunning()) {
            console.log('Starting CI Caddy...');
            await caddyHelper.start();
            console.log('CI Caddy started.');
        }
        await caddyHelper.configure(workerCount);

        console.log('Starting SSO server...');
        await SsoHelper.start(workerCount);
        console.log('SSO server started.');
    };

    const buildFrontend = async () => {
        if (process.env.STAMHOOFD_SKIP_FRONTEND_BUILD === 'true') {
            console.log('Skipped frontend build.');
            return;
        }
        await frontendBuilder.build();
    };

    const migrateDatabases = async () => {
        const workerCount = getWorkerCount();
        const { run: runMigrations } = await import('@stamhoofd/backend/migrate');

        for (let workerId = 0; workerId < workerCount; workerId += 1) {
            const database = DatabaseHelper.getDatabaseName(workerId.toString());
            console.log(`Migrating ${database}...`);
            TestUtils.setEnvironment('DB_DATABASE', database);
            await runMigrations();
        }
    };

    for (const promise of [configureCaddyAndStartSso(), buildFrontend(), migrateDatabases()]) {
        await promise;
    }
}
