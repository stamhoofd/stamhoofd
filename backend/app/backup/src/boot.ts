import { CORSPreflightEndpoint, Router, RouterServer } from '@simonbackx/simple-endpoints';
import { CORSMiddleware, LogMiddleware } from '@stamhoofd/backend-middleware';
import { loadLogger } from '@stamhoofd/logging';
import { startCrons, stopCrons, waitForCrons } from '@stamhoofd/crons';
import { cleanBackups } from './helpers/backup.js';

process.on('unhandledRejection', (error: Error) => {
    console.error('unhandledRejection');
    console.error(error.message, error.stack);
    process.exit(1);
});

// Set timezone!
process.env.TZ = 'UTC';

// Quick check
if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

const start = async () => {
    console.log('Started Backup.');
    loadLogger();
    const router = new Router();
    await router.loadEndpoints(__dirname + '/endpoints');
    router.endpoints.push(new CORSPreflightEndpoint());

    const routerServer = new RouterServer(router);
    routerServer.verbose = false;

    // Send the app version along
    routerServer.addRequestMiddleware(LogMiddleware);
    routerServer.addResponseMiddleware(LogMiddleware);

    // Add CORS headers
    routerServer.addResponseMiddleware(CORSMiddleware);

    routerServer.listen(STAMHOOFD.PORT ?? 9090);

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
    startCrons();

    // Clean backups on boot (bit faster to retrieve the timestamp of the last backup for the health endpoint)
    await cleanBackups();
};

start().catch((error) => {
    console.error('unhandledRejection', error);
    process.exit(1);
});
