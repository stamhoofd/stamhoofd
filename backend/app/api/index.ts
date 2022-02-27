require('@stamhoofd/backend-env').load()
import { Column, Database } from "@simonbackx/simple-database";
import { CORSPreflightEndpoint, Router, RouterServer } from "@simonbackx/simple-endpoints";
import { I18n } from "@stamhoofd/backend-i18n";
import { Email } from "@stamhoofd/email";
import { Version } from '@stamhoofd/structures';
import { sleep } from "@stamhoofd/utility";

import { areCronsRunning, crons } from './src/crons';
import { AppVersionMiddleware } from "./src/helpers/AppVersionMiddleware";
import { CORSMiddleware } from "./src/helpers/CORSMiddleware";

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
    console.log("Loading locales...")
    await I18n.load()

    console.log("Initialising server...")
    const router = new Router();
    await router.loadAllEndpoints(__dirname + "/src/endpoints");
    await router.loadAllEndpoints(__dirname + "/src/endpoints/*");
    router.endpoints.push(new CORSPreflightEndpoint())

    const routerServer = new RouterServer(router);
    routerServer.verbose = false
    
    // Send the app version along
    routerServer.addResponseMiddleware(AppVersionMiddleware)
    routerServer.addResponseMiddleware(CORSMiddleware)
    routerServer.addRequestMiddleware(AppVersionMiddleware)
    /*routerServer.defaultHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PATCH, PUT, DELETE",
        "Access-Control-Expose-Headers": "*",
        "Access-Control-Max-Age": "86400"
    };*/

    routerServer.listen(STAMHOOFD.PORT ?? 9090);

    if (routerServer.server) {
        // Default timeout is a bit too short
        routerServer.server.timeout = 15000;
    }

    const cronInterval = setInterval(crons, 5 * 60 * 1000);
    crons()

    const shutdown = async () => {
        console.log("Shutting down...")
        // Disable keep alive
        routerServer.defaultHeaders = Object.assign(routerServer.defaultHeaders, { 'Connection': 'close' })
        if (routerServer.server) {
            routerServer.server.headersTimeout = 5000;
            routerServer.server.keepAliveTimeout = 1;
        }

        clearInterval(cronInterval)

        try {
            await routerServer.close()
            console.log("HTTP server stopped");
        } catch (err) {
            console.error("Failed to stop HTTP server:");
            console.error(err);
        }

        try {
            while (areCronsRunning()) {
                console.log("Crons are still running. Waiting 2 seconds...")
                await sleep(2000)
            }
        } catch (err) {
            console.error("Failed to wait for crons to finish:");
            console.error(err);
        }

        try {
            while (Email.currentQueue.length > 0) {
                console.log("Emails still in queue. Waiting 2 seconds...")
                await sleep(2000)
            }
        } catch (err) {
            console.error("Failed to wait for emails to finish:");
            console.error(err);
        }

        try {
            await Database.end()
            console.log("MySQL connections closed");
        } catch (err) {
            console.error("Failed to close MySQL connection:")
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
