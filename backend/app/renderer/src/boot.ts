import { fatalBackendException } from '@stamhoofd/backend-env';
import { CORSPreflightEndpoint, Router, RouterServer } from '@node/endpoints';
import { type ApplicationLifecycle, observeHttpServer, traceEndpoint } from '@node/observability';
import { I18n } from '@stamhoofd/backend-i18n';
import { CORSMiddleware, LogMiddleware } from '@stamhoofd/backend-middleware';
import { loadLogger } from '@stamhoofd/logging';
import { TrustedIPWhitelist } from './classes/TrustedIPWhitelist.js';

process.on('unhandledRejection', error => fatalBackendException('rejection', error));

// Set timezone!
process.env.TZ = 'UTC';
Error.stackTraceLimit = 50;

// Quick check
if (new Date().getTimezoneOffset() !== 0) {
    throw new Error('Process should always run in UTC timezone');
}

export const boot = async (lifecycle: ApplicationLifecycle) => {
    loadLogger();
    console.debug('Started Renderer.');
    await I18n.load();

    // Load the trusted IP whitelist that guards the /prerender endpoint (no-op when not configured).
    await TrustedIPWhitelist.shared.load();
    TrustedIPWhitelist.shared.startAutoRefresh();

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

    const shutdown = async () => {
        console.log('Shutting down...');
        // Disable keep alive
        routerServer.defaultHeaders = Object.assign(routerServer.defaultHeaders, { Connection: 'close' });
        if (routerServer.server) {
            routerServer.server.headersTimeout = 5000;
            routerServer.server.keepAliveTimeout = 1;
        }

        try {
            await routerServer.close();
            console.log('HTTP server stopped');
        } catch (err) {
            console.error('Failed to stop HTTP server:');
            console.error(err);
        }

        // Should not be needed, but added for security as sometimes a promise hangs somewhere
        await lifecycle.close();
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
    await lifecycle.ready(routerServer.server);
};
