import { CaddyHelper } from "./helpers/CaddyHelper";
import { FrontendBuilder } from "./helpers/FrontendBuilder";

export default async function globalSetup() {
    if (process.env.NODE_ENV !== "test") {
        throw new Error(
            "Global setup should not run if not in test environment",
        );
    }
    
    const frontendBuilder = new FrontendBuilder();
    const caddyHelper = new CaddyHelper();

    const buildFrontend = async () => {
        if(process.env.STAMHOOFD_SKIP_FRONTEND_BUILD === 'true') {
            console.log('Skipping frontend build...');
            return;
        }
        await frontendBuilder.build();
    }

    for(const promise of [
        buildFrontend(),
        // make sure all caddy configuration for playwrigth is deleted
        caddyHelper.deletePlaywrightConfig(),
    ]) {
        await promise;
    }
}
