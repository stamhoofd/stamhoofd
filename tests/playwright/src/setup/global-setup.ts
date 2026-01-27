import { TestUtils } from '@stamhoofd/test-utils';
import { CaddyHelper } from './helpers/CaddyHelper';
import { FrontendBuilder } from './helpers/FrontendBuilder';
import { PlaywrightHooks } from './helpers/PlaywrightHooks';

// Make sure initial env is loaded
// eslint-disable-next-line @typescript-eslint/no-floating-promises
TestUtils.globalSetup(new PlaywrightHooks());

export default async function globalSetup() {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error(
            'Global setup should not run if not in test environment',
        );
    }

    const frontendBuilder = new FrontendBuilder();
    const caddyHelper = new CaddyHelper();

    const startCaddy = async () => {
        if (!await caddyHelper.isRunning()) {
            console.log('Starting caddy...');
            await caddyHelper.start();
            console.log('Caddy started.');
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

    for (const promise of [startCaddy(), buildFrontend()]) {
        await promise;
    }
}
