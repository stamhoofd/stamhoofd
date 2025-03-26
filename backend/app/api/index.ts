import backendEnv from '@stamhoofd/backend-env';
backendEnv.load({ service: 'api' });

import { Column, Database, Migration } from '@simonbackx/simple-database';
import { CORSPreflightEndpoint, Router, RouterServer } from '@simonbackx/simple-endpoints';
import { CORSMiddleware, LogMiddleware, VersionMiddleware } from '@stamhoofd/backend-middleware';
import { Email } from '@stamhoofd/email';
import { loadLogger } from '@stamhoofd/logging';
import { Version } from '@stamhoofd/structures';
import { sleep } from '@stamhoofd/utility';

import { startCrons, stopCrons, waitForCrons } from '@stamhoofd/crons';
import { Platform } from '@stamhoofd/models';
import { resumeEmails } from './src/helpers/EmailResumer';
import { GlobalHelper } from './src/helpers/GlobalHelper';
import { SetupStepUpdater } from './src/helpers/SetupStepUpdater';
import { ContextMiddleware } from './src/middleware/ContextMiddleware';
import { AuditLogService } from './src/services/AuditLogService';
import { DocumentService } from './src/services/DocumentService';
import { FileSignService } from './src/services/FileSignService';
import { PlatformMembershipService } from './src/services/PlatformMembershipService';
import { UniqueUserService } from './src/services/UniqueUserService';

process.on('unhandledRejection', (error: Error) => {
    console.error('unhandledRejection');
    console.error(error.message, error.stack);
    process.exit(1);
});

// Set version of saved structures
Column.setJSONVersion(Version);

// Set timezone
process.env.TZ = 'UTC';

// Quick check
if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

const seeds = async () => {
    try {
        // Internal
        await AuditLogService.disable(async () => {
            await Migration.runAll(__dirname + '/src/seeds');
        });
    }
    catch (e) {
        console.error('Failed to run seeds:');
        console.error(e);
    }
};
const bootTime = process.hrtime();

const start = async () => {
    console.log('Running server at v' + Version);
    loadLogger();

    await GlobalHelper.load();
    await UniqueUserService.check();

    // Init platform shared struct: otherwise permissions won't work with missing responsibilities
    console.log('Loading platform...');
    await Platform.loadCaches();

    const router = new Router();

    console.log('Loading endpoints...');

    // Note: we should load endpoints one by once to have a reliable order of url matching
    await router.loadAllEndpoints(__dirname + '/src/endpoints/global/*');
    await router.loadAllEndpoints(__dirname + '/src/endpoints/admin/*');
    await router.loadAllEndpoints(__dirname + '/src/endpoints/auth');
    await router.loadAllEndpoints(__dirname + '/src/endpoints/organization/dashboard/*');
    await router.loadAllEndpoints(__dirname + '/src/endpoints/organization/registration');
    await router.loadAllEndpoints(__dirname + '/src/endpoints/organization/webshops');
    await router.loadAllEndpoints(__dirname + '/src/endpoints/organization/shared');
    await router.loadAllEndpoints(__dirname + '/src/endpoints/organization/shared/*');

    router.endpoints.push(new CORSPreflightEndpoint());

    console.log('Creating router...');
    const routerServer = new RouterServer(router);
    routerServer.verbose = false;

    // Log requests and errors
    routerServer.addRequestMiddleware(LogMiddleware);
    routerServer.addResponseMiddleware(LogMiddleware);

    routerServer.addResponseMiddleware(FileSignService);
    routerServer.addRequestMiddleware(FileSignService);

    // Contexts
    routerServer.addRequestMiddleware(ContextMiddleware);

    // Add version headers and minimum version
    const versionMiddleware = new VersionMiddleware({
        latestVersions: {
            android: STAMHOOFD.LATEST_ANDROID_VERSION,
            ios: STAMHOOFD.LATEST_IOS_VERSION,
            web: Version,
        },
        minimumVersion: 331,
    });
    routerServer.addRequestMiddleware(versionMiddleware);
    routerServer.addResponseMiddleware(versionMiddleware);

    // Add CORS headers
    routerServer.addResponseMiddleware(CORSMiddleware);

    console.log('Loading loaders...');

    // Register Excel loaders
    await import('./src/excel-loaders');

    // Register Email Recipient loaders
    await import('./src/email-recipient-loaders/members');
    await import('./src/email-recipient-loaders/orders');
    await import('./src/email-recipient-loaders/receivable-balances');

    console.log('Opening port...');
    routerServer.listen(STAMHOOFD.PORT ?? 9090);

    const hrend = process.hrtime(bootTime);
    console.log('🟢 HTTP server started in ' + Math.ceil(hrend[0] * 1000 + hrend[1] / 1000000) + 'ms');

    resumeEmails().catch(console.error);

    if (routerServer.server) {
        // Default timeout is a bit too short
        routerServer.server.timeout = 61000;
    }

    let shuttingDown = false;
    const shutdown = async () => {
        if (shuttingDown) {
            return;
        }
        shuttingDown = true;
        console.log('Shutting down...');
        // Disable keep alive
        routerServer.defaultHeaders = Object.assign(routerServer.defaultHeaders, { Connection: 'close' });
        if (routerServer.server) {
            routerServer.server.headersTimeout = 5000;
            routerServer.server.keepAliveTimeout = 1;
        }

        stopCrons();

        if (STAMHOOFD.environment === 'development') {
            setTimeout(() => {
                console.error('Forcing exit after 5 seconds');
                process.exit(1);
            }, 5000);
        }

        try {
            await routerServer.close();
            console.log('HTTP server stopped');
        }
        catch (err) {
            console.error('Failed to stop HTTP server:');
            console.error(err);
        }

        await waitForCrons();

        try {
            while (Email.currentQueue.length > 0) {
                console.log('Emails still in queue. Waiting 2 seconds...');
                await sleep(2000);
            }
        }
        catch (err) {
            console.error('Failed to wait for emails to finish:');
            console.error(err);
        }

        try {
            await Database.end();
            console.log('MySQL connections closed');
        }
        catch (err) {
            console.error('Failed to close MySQL connection:');
            console.error(err);
        }

        // Should not be needed, but added for security as sometimes a promise hangs somewhere
        process.exit(0);
    };

    process.on('SIGTERM', () => {
        console.info('SIGTERM signal received.');
        shutdown().catch((e) => {
            console.error(e);
            process.exit(1);
        });
    });

    process.on('SIGINT', () => {
        console.info('SIGINT signal received.');
        shutdown().catch((e) => {
            console.error(e);
            process.exit(1);
        });
    });

    // Register crons
    await import('./src/crons');
    startCrons();
    seeds().catch(console.error);

    AuditLogService.listen();
    PlatformMembershipService.listen();
    DocumentService.listen();
    SetupStepUpdater.listen();
};

start().catch((error) => {
    console.error('unhandledRejection', error);
    process.exit(1);
});
