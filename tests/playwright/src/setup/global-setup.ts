import os from 'node:os';
import { TestUtils } from '@stamhoofd/test-utils';
import { CaddyHelper } from './helpers/CaddyHelper.js';
import { DatabaseHelper } from './helpers/DatabaseHelper.js';
import { FrontendBuilder } from './helpers/FrontendBuilder.js';
import { PlaywrightHooks } from './helpers/PlaywrightHooks.js';
import { SGVMockBuilder } from './helpers/SGVMockBuilder.js';

// Make sure initial env is loaded

TestUtils.globalSetup(new PlaywrightHooks());

export default async function globalSetup() {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error(
            'Global setup should not run if not in test environment',
        );
    }

    const frontendBuilder = new FrontendBuilder();
    const sgvMockBuilder = new SGVMockBuilder();
    const caddyHelper = new CaddyHelper();

    const configureCaddy = async () => {
        const workerCount = getExpectedWorkerCount();
        if (!await caddyHelper.isRunning()) {
            console.log('Starting CI Caddy...');
            await caddyHelper.start();
            console.log('CI Caddy started.');
        }
        await caddyHelper.configure(workerCount);
    };

    const buildFrontend = async () => {
        if (process.env.STAMHOOFD_SKIP_FRONTEND_BUILD === 'true') {
            console.log('Skipped frontend build.');
            return;
        }
        await frontendBuilder.build();
    };

    const migrateDatabases = async () => {
        const workerCount = getExpectedWorkerCount();
        const { run: runMigrations } = await import('@stamhoofd/backend/migrate');

        for (let workerId = 0; workerId < workerCount; workerId += 1) {
            const database = DatabaseHelper.getDatabaseName(workerId.toString());
            console.log(`Migrating ${database}...`);
            TestUtils.setEnvironment('DB_DATABASE', database);
            await runMigrations();
        }
    };

    const buildSGVMock = async () => {
        await sgvMockBuilder.build();
    };

    for (const promise of [configureCaddy(), buildFrontend(), buildSGVMock(), migrateDatabases()]) {
        await promise;
    }
}

function getExpectedWorkerCount() {
    const explicitWorkerCount = process.env.PLAYWRIGHT_WORKER_COUNT ? parseInt(process.env.PLAYWRIGHT_WORKER_COUNT) : undefined;
    if (explicitWorkerCount !== undefined && Number.isFinite(explicitWorkerCount) && explicitWorkerCount > 0) {
        return explicitWorkerCount;
    }

    if (process.env.CI) {
        return 2;
    }

    return Math.max(1, Math.floor(os.availableParallelism() / 2));
}
