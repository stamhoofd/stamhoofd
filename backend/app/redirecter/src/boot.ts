import { Router, RouterServer } from '@simonbackx/simple-endpoints';
import { LogMiddleware } from '@stamhoofd/backend-middleware';
import { Country } from '@stamhoofd/types/Country';
import { Geolocator } from './classes/Geolocator.js';

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
    await Geolocator.shared.load(import.meta.dirname + '/data/belgium.csv', Country.Belgium);

    // Netherlands not needed, because it is the current default
    // await Geolocator.shared.load(import.meta.dirname+"/data/netherlands.csv", Country.Netherlands)

    console.log('Initialising server...');
    const router = new Router();
    await router.loadAllEndpoints(import.meta.dirname + '/endpoints');
    await router.loadAllEndpoints(import.meta.dirname + '/endpoints/*');

    const routerServer = new RouterServer(router);
    routerServer.verbose = false;
    routerServer.listen(STAMHOOFD.PORT ?? 9090);

    // Send the app version along
    routerServer.addRequestMiddleware(LogMiddleware);
    routerServer.addResponseMiddleware(LogMiddleware);

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
        }
        catch (err) {
            console.error('Failed to stop HTTP server:');
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
};

start().catch((error) => {
    console.error('unhandledRejection', error);
    process.exit(1);
});
