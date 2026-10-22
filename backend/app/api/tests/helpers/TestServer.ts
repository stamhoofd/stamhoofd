import { TestServer } from '@simonbackx/simple-endpoints';
import { VersionMiddleware } from '@stamhoofd/backend-middleware';
import { Version } from '@stamhoofd/structures';

import { ContextMiddleware } from '../../src/middleware/ContextMiddleware.js';
import { HumanErrorMessageMiddleware } from '../../src/middleware/HumanErrorMessageMiddleware.js';
import { TenantScopeMiddleware } from '../../src/middleware/TenantScopeMiddleware.js';
import { FileSignService } from '../../src/services/FileSignService.js';

export const testServer = new TestServer();

// Registration order mirrors boot.ts
testServer.addResponseMiddleware(FileSignService);
testServer.addRequestMiddleware(FileSignService);

testServer.addRequestMiddleware(HumanErrorMessageMiddleware);

// Contexts
testServer.addRequestMiddleware(ContextMiddleware);

testServer.addRequestMiddleware(TenantScopeMiddleware);

// Add version headers and minimum version
const versionMiddleware = new VersionMiddleware({
    latestVersions: {
        android: STAMHOOFD.LATEST_ANDROID_VERSION,
        ios: STAMHOOFD.LATEST_IOS_VERSION,
        web: Version,
    },
    minimumVersion: 1, // 168
});
testServer.addRequestMiddleware(versionMiddleware);
