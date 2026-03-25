import { CaddyHelper } from './helpers/CaddyHelper.js';
import { ProcessInfo } from './helpers/ProcessInfo.js';

export default async function globalTeardown() {
    const caddyHelper = new CaddyHelper();
    if (await caddyHelper.isRunning()) {
        if (ProcessInfo.didStartCaddy) {
            // only stop caddy if Playwright started caddy
            console.log('Stopping caddy...');
            await caddyHelper.stop();
        }
        else {
            // todo: restore original config
        }
    }
}
