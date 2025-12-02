import { Column, Database, Migration } from '@simonbackx/simple-database';
import { CORSPreflightEndpoint, Router, RouterServer } from '@simonbackx/simple-endpoints';
import { CORSMiddleware, LogMiddleware, VersionMiddleware } from '@stamhoofd/backend-middleware';
import { Email } from '@stamhoofd/email';
import { loadLogger } from '@stamhoofd/logging';
import { Version } from '@stamhoofd/structures';
import { sleep } from '@stamhoofd/utility';

import { SimpleError } from '@simonbackx/simple-errors';
import { startCrons, stopCrons, waitForCrons } from '@stamhoofd/crons';
import { Platform } from '@stamhoofd/models';
import { QueueHandler } from '@stamhoofd/queues';
import { resumeEmails } from './helpers/EmailResumer';
import { GlobalHelper } from './helpers/GlobalHelper';
import { SetupStepUpdater } from './helpers/SetupStepUpdater';
import { ContextMiddleware } from './middleware/ContextMiddleware';
import { AuditLogService } from './services/AuditLogService';
import { BalanceItemService } from './services/BalanceItemService';
import { DocumentService } from './services/DocumentService';
import { FileSignService } from './services/FileSignService';
import { PlatformMembershipService } from './services/PlatformMembershipService';
import { UitpasService } from './services/uitpas/UitpasService';
import { UniqueUserService } from './services/UniqueUserService';

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
            await Migration.runAll(__dirname + '/seeds');
        });
    }
    catch (e) {
        console.error('Failed to run seeds:');
        console.error(e);
    }
};
const bootTime = process.hrtime();

function productionLog(message: string) {
    if (STAMHOOFD.environment !== 'development') {
        console.log(message);
    }
}

export const boot = async () => {
    productionLog('Running server at v' + Version);
    productionLog('Running server at port ' + STAMHOOFD.PORT);
    productionLog('Running server on DB ' + process.env.DB_DATABASE); // note, should always use process env here

    loadLogger();

    await GlobalHelper.load();
    await UniqueUserService.check();

    // Init platform shared struct: otherwise permissions won't work with missing responsibilities
    productionLog('Loading platform...');
    await Platform.loadCaches();

    const router = new Router();

    productionLog('Loading endpoints...');

    // Note: we should load endpoints one by once to have a reliable order of url matching
    await router.loadAllEndpoints(__dirname + '/endpoints/global/*');
    await router.loadAllEndpoints(__dirname + '/endpoints/admin/*');
    await router.loadAllEndpoints(__dirname + '/endpoints/frontend');

    await router.loadAllEndpoints(__dirname + '/endpoints/auth');
    await router.loadAllEndpoints(__dirname + '/endpoints/organization/dashboard/*');
    await router.loadAllEndpoints(__dirname + '/endpoints/organization/registration');
    await router.loadAllEndpoints(__dirname + '/endpoints/organization/webshops');
    await router.loadAllEndpoints(__dirname + '/endpoints/organization/shared');
    await router.loadAllEndpoints(__dirname + '/endpoints/organization/shared/*');

    router.endpoints.push(new CORSPreflightEndpoint());

    productionLog('Creating router...');
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

    productionLog('Loading loaders...');

    // Register Excel loaders
    await import('./excel-loaders');

    // Register Email Recipient loaders
    await import('./email-recipient-loaders/members');
    await import('./email-recipient-loaders/registrations');
    await import('./email-recipient-loaders/orders');
    await import('./email-recipient-loaders/receivable-balances');
    await import('./excel-loaders/registrations');

    productionLog('Opening port...');
    routerServer.listen(STAMHOOFD.PORT ?? 9090);

    const hrend = process.hrtime(bootTime);
    productionLog('🟢 HTTP server started in ' + Math.ceil(hrend[0] * 1000 + hrend[1] / 1000000) + 'ms');

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
        productionLog('Shutting down...');
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
            productionLog('HTTP server stopped');
        }
        catch (err) {
            console.error('Failed to stop HTTP server:');
            console.error(err);
        }

        await BalanceItemService.flushAll();
        await waitForCrons();
        QueueHandler.abortAll(
            new SimpleError({
                code: 'SHUTDOWN',
                message: 'Shutting down',
                statusCode: 503,
            }),
        );
        await QueueHandler.awaitAll();

        try {
            while (Email.currentQueue.length > 0) {
                console.log(`${Email.currentQueue.length} emails still in queue. Waiting 500ms...`);
                await sleep(500);
            }
        }
        catch (err) {
            console.error('Failed to wait for emails to finish:');
            console.error(err);
        }

        try {
            await Database.end();
            productionLog('MySQL connections closed');
        }
        catch (err) {
            console.error('Failed to close MySQL connection:');
            console.error(err);
        }

        // Should not be needed, but added for security as sometimes a promise hangs somewhere
        if (STAMHOOFD.environment !== 'test') {
            process.exit(0);
        }
    };

    if (STAMHOOFD.environment !== 'test') {
        process.on('SIGTERM', () => {
            productionLog('SIGTERM signal received.');
            shutdown().catch((e) => {
                console.error(e);
                process.exit(1);
            });
        });

        process.on('SIGINT', () => {
            productionLog('SIGINT signal received.');
            shutdown().catch((e) => {
                console.error(e);
                process.exit(1);
            });
        });
    }

    // Register crons
    await import('./crons');

    AuditLogService.listen();
    PlatformMembershipService.listen();
    DocumentService.listen();
    SetupStepUpdater.listen();
    UitpasService.listen();

    startCrons();
    seeds().catch(console.error);

    return { shutdown };
};
