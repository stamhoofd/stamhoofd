require('dotenv').config()
import { Column, Database } from "@simonbackx/simple-database";
import { CORSPreflightEndpoint, Router, RouterServer } from "@simonbackx/simple-endpoints";
import { Version } from '@stamhoofd/structures';

import { crons } from './src/crons';

process.on("unhandledRejection", (error: Error) => {
    console.error("unhandledRejection");
    console.error(error.message, error.stack);
    process.exit(1);
});

// Set version of saved structures
Column.jsonVersion = Version

// Set timezone!
process.env.TZ = "UTC";

// Quick check
if (new Date().getTimezoneOffset() != 0) {
    throw new Error("Process should always run in UTC timezone");
}


const start = async () => {
    const router = new Router();
    await router.loadAllEndpoints(__dirname + "/src/endpoints");
    router.endpoints.push(new CORSPreflightEndpoint())

    const routerServer = new RouterServer(router);
    routerServer.verbose = false
    // tmp
    routerServer.defaultHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PATCH, PUT, DELETE",
        "Access-Control-Max-Age": "86400"
    };
    routerServer.listen(parseInt(process.env.PORT ?? "9090"));

    const cronInterval = setInterval(crons, 60 * 1000);
    crons()

    const shutdown = () => {
        console.log("Shutdown...")
        // Disable keep alive
        routerServer.defaultHeaders = Object.assign(routerServer.defaultHeaders, { 'Connection': 'close' })
        if (routerServer.server) {
            routerServer.server.headersTimeout = 5000;
            routerServer.server.keepAliveTimeout = 1;
        }

        clearInterval(cronInterval)

        routerServer
            .close()
            .then(() => {
                console.log("Server stopped");

                Database.end()
                    .then(() => {
                        console.log("MySQL connections closed");

                        // Should not be needed, but added for security
                        process.exit(0);
                    })
                    .catch(err => {
                        console.error(err);
                        process.exit(1);
                    });
            })
            .catch(err => {
                console.error(err);
                Database.end()
                    .then(() => {
                        console.log("MySQL connections closed");

                        // Should not be needed, but added for security
                        process.exit(1);
                    })
                    .catch(err => {
                        console.error(err);
                        process.exit(1);
                    });
            });
    };

    process.on("SIGTERM", () => {
        console.info("SIGTERM signal received.");
        shutdown();
    });

    process.on("SIGINT", () => {
        console.info("SIGINT signal received.");
        shutdown();
    });
};

start().catch(error => {
    console.error("unhandledRejection", error);
    process.exit(1);
});
