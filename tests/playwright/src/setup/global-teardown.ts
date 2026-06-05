import { CaddyHelper } from './helpers/CaddyHelper.js';
import { ProcessInfo } from './helpers/ProcessInfo.js';

export default async function globalTeardown() {
    if (!ProcessInfo.didStartCaddy) {
        return;
    }

    console.log('Stopping CI Caddy...');
    await new CaddyHelper().stop();
}
