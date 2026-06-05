import { TestUtils } from '@stamhoofd/test-utils';
import { CaddyHelper } from './helpers/CaddyHelper.js';
import { FrontendBuilder } from './helpers/FrontendBuilder.js';
import { PlaywrightHooks } from './helpers/PlaywrightHooks.js';

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

    const configureCaddy = async () => {
        if (!await caddyHelper.isRunning()) {
            throw new Error('Shared Caddy is not running. Run `yarn stam services up` first.');
        }
        await caddyHelper.configure();
    };

    const buildFrontend = async () => {
        if (process.env.STAMHOOFD_SKIP_FRONTEND_BUILD === 'true') {
            console.log('Skipped frontend build.');
            return;
        }
        await frontendBuilder.build();
    };

    for (const promise of [configureCaddy(), buildFrontend()]) {
        await promise;
    }
}
