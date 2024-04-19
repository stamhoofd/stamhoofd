import { TestServer } from "@simonbackx/simple-endpoints";
import { VersionMiddleware } from "@stamhoofd/backend-middleware";
import { Version } from "@stamhoofd/structures";

import { ContextMiddleware } from "../../src/middleware/ContextMiddleware";

export const testServer = new TestServer();

// Contexts
testServer.addRequestMiddleware(ContextMiddleware)

// Add version headers and minimum version
const versionMiddleware = new VersionMiddleware({
    latestVersions: {
        android: STAMHOOFD.LATEST_ANDROID_VERSION,
        ios: STAMHOOFD.LATEST_IOS_VERSION,
        web: Version
    },
    minimumVersion: 1 //168
})
testServer.addRequestMiddleware(versionMiddleware)