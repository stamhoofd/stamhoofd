import { CaddyHelper } from "./helpers/CaddyHelper";
import { PlaywrightCaddyConfigHelper } from "./helpers/PlaywrightCaddyConfigHelper";
import { ProcessInfo } from "./helpers/ProcessInfo";

export default async function globalTeardown() {
    const caddyHelper = new CaddyHelper();
    if (await caddyHelper.isRunning()) {
        if (ProcessInfo.didStartCaddy) {
            // only stop caddy if Playwright started caddy
            console.log("Stopping caddy...");
            await caddyHelper.stop();
        } else {
            // else clear the configuration for playwright
            console.log("Clearing playwright caddy config...");
            await PlaywrightCaddyConfigHelper.clear(caddyHelper);
        }
    }
}
