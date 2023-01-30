require('@stamhoofd/backend-env').load({service: 'renderer'});
import { CORSPreflightEndpoint, Router, RouterServer } from "@simonbackx/simple-endpoints";
import { I18n } from "@stamhoofd/backend-i18n";
import { CORSMiddleware, LogMiddleware } from "@stamhoofd/backend-middleware";
import { loadLogger } from "@stamhoofd/logging";

process.on("unhandledRejection", (error: Error) => {
    console.error("unhandledRejection");
    console.error(error.message, error.stack);
    process.exit(1);
});

// Set timezone!
process.env.TZ = "UTC";

// Quick check
if (new Date().getTimezoneOffset() != 0) {
    throw new Error("Process should always run in UTC timezone");
}

const start = async () => {
    console.log('Started Renderer.')
    loadLogger();
    await I18n.load()
    const router = new Router();
    await router.loadEndpoints(__dirname + "/src/endpoints");
    router.endpoints.push(new CORSPreflightEndpoint())

    const routerServer = new RouterServer(router);
    routerServer.verbose = false
    
    // Send the app version along
    routerServer.addRequestMiddleware(LogMiddleware)
    routerServer.addResponseMiddleware(LogMiddleware)

    // Add CORS headers
    routerServer.addResponseMiddleware(CORSMiddleware)

    routerServer.listen(STAMHOOFD.PORT ?? 9090);

    if (routerServer.server) {
        // Default timeout is a bit too short
        routerServer.server.timeout = 15000;
    }

    const shutdown = async () => {
        console.log("Shutting down...")
        // Disable keep alive
        routerServer.defaultHeaders = Object.assign(routerServer.defaultHeaders, { 'Connection': 'close' })
        if (routerServer.server) {
            routerServer.server.headersTimeout = 5000;
            routerServer.server.keepAliveTimeout = 1;
        }

        try {
            await routerServer.close()
            console.log("HTTP server stopped");
        } catch (err) {
            console.error("Failed to stop HTTP server:");
            console.error(err);
        }

        // Should not be needed, but added for security as sometimes a promise hangs somewhere
        process.exit(0);
    };

    process.on("SIGTERM", () => {
        console.info("SIGTERM signal received.");
        shutdown().catch((e) => {
            console.error(e)
            process.exit(1);
        });
    });

    process.on("SIGINT", () => {
        console.info("SIGINT signal received.");
        shutdown().catch((e) => {
            console.error(e)
            process.exit(1);
        });
    });
};

start().catch(error => {
    console.error("unhandledRejection", error);
    process.exit(1);
});
