import { CaddyHelper } from "./helpers/CaddyHelper";

export default async function globalTeardown() {
    const caddyHelper = new CaddyHelper();
    await caddyHelper.deletePlaywrightConfig();
}
