import { CaddyHelper } from './helpers/CaddyHelper.js';
import { ProcessInfo } from './helpers/ProcessInfo.js';

export default async function globalTeardown() {
    console.log(ProcessInfo.didStartCaddy ? 'Stopping CI Caddy...' : 'Removing Playwright Caddy routes...');
    await new CaddyHelper().cleanup();
}
