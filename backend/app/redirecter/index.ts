require('@stamhoofd/backend-env').load({ service: "redirecter" })
import { Router, RouterServer } from "@simonbackx/simple-endpoints";
import { Country } from "@stamhoofd/structures";

import { Geolocator } from "./src/classes/Geolocator";

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
    await Geolocator.shared.load(__dirname+"/src/data/belgium.csv", Country.Belgium)

    // Netherlands not needed, because it is the current default
    //await Geolocator.shared.load(__dirname+"/src/data/netherlands.csv", Country.Netherlands)

    console.log("Initialising server...")
    const router = new Router();
    await router.loadAllEndpoints(__dirname + "/src/endpoints");
    await router.loadAllEndpoints(__dirname + "/src/endpoints/*");

    const routerServer = new RouterServer(router);
    routerServer.verbose = false
    routerServer.listen(STAMHOOFD.PORT ?? 9090);

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
