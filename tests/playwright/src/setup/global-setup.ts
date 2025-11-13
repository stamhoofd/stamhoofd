import { CaddyHelper } from "./helpers/CaddyHelper";

export default async function globalSetup() {
    if (process.env.NODE_ENV !== "test") {
        throw new Error(
            "Global setup should not run if not in test environment",
        );
    }

    const caddyHelper = new CaddyHelper();

    // make sure all caddy configuration for playwrigth is deleted
    await caddyHelper.deletePlaywrightConfig();
}
