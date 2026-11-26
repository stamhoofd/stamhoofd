import { fatalBackendException } from '@stamhoofd/backend-env';
import { CORSPreflightEndpoint, Router, RouterServer } from '@node/endpoints';
import { initializeMetrics, observeHttpServer, traceEndpoint } from '@node/observability';
import { CORSMiddleware, LogMiddleware } from '@stamhoofd/backend-middleware';
import { startCrons, stopCrons, waitForCrons } from '@stamhoofd/crons';
import { loadLogger } from '@stamhoofd/logging';
import { cleanBackups } from './helpers/backup.js';

process.on('unhandledRejection', (error) => fatalBackendException('rejection', error));

// Set timezone!
process.env.TZ = 'UTC';
Error.stackTraceLimit = 50;

// Quick check
if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

const start = async () => {
    const metrics = initializeMetrics('backup');
    console.log('Started Backup.');
    loadLogger();
    const router = new Router();
    await router.loadEndpoints(import.meta.dirname + '/endpoints');
    router.endpoints.push(new CORSPreflightEndpoint());

    const routerServer = new RouterServer(router);
    routerServer.observeEndpoint = traceEndpoint;
    routerServer.verbose = false;

    // Send the app version along
    routerServer.addRequestMiddleware(LogMiddleware);
    routerServer.addResponseMiddleware(LogMiddleware);

    // Add CORS headers
    routerServer.addResponseMiddleware(CORSMiddleware);

    routerServer.listen(STAMHOOFD.PORT ?? 9090);
    observeHttpServer(routerServer.server);

    if (routerServer.server) {
        // Default timeout is a bit too short
        routerServer.server.timeout = 15000;
    }

    if (STAMHOOFD.environment === 'development') {
        return;
    }

    const shutdown = async () => {
        console.log('Shutting down...');
        // Disable keep alive
        routerServer.defaultHeaders = Object.assign(routerServer.defaultHeaders, {
            Connection: 'close',
        });
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
        } catch (err) {
            console.error('Failed to stop HTTP server:');
            console.error(err);
        }

        await waitForCrons();

        await metrics?.shutdown();

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
    await import('./crons.js');
    startCrons({ allowReadOnly: true, allowBeforeSeeds: true });

    // Clean backups on boot (bit faster to retrieve the timestamp of the last backup for the health endpoint)
    await cleanBackups();
};

start().catch((error) => fatalBackendException('startup', error));
