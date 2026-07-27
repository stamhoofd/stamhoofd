import { CaddyHelper } from './helpers/CaddyHelper.js';
import { ProcessInfo } from './helpers/ProcessInfo.js';
import { SsoHelper } from './helpers/SsoHelper.js';

export default async function globalTeardown() {
    console.log('Stopping SSO server...');
    try {
        await SsoHelper.stop();
    }
    catch (error) {
        // Never let a leftover container fail the run: it is replaced on the next start anyway.
        console.warn(`Failed to stop the SSO server: ${error instanceof Error ? error.message : String(error)}`);
    }

    console.log(ProcessInfo.didStartCaddy ? 'Stopping CI Caddy...' : 'Removing Playwright Caddy routes...');
    await new CaddyHelper().cleanup();
}
