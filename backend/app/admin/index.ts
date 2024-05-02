require('@stamhoofd/backend-env').load()
import { Column, Database, Migration } from "@simonbackx/simple-database";
import { CORSPreflightEndpoint, Router, RouterServer } from "@simonbackx/simple-endpoints";
import { I18n } from "@stamhoofd/backend-i18n";
import { CORSMiddleware, LogMiddleware, VersionMiddleware } from "@stamhoofd/backend-middleware";
import { Email } from "@stamhoofd/email";
import { loadLogger } from "@stamhoofd/logging";
import { Version } from '@stamhoofd/structures';
import { sleep } from "@stamhoofd/utility";

import { areCronsRunning, crons } from "./src/crons";

process.on("unhandledRejection", (error: Error) => {
    console.error("unhandledRejection");
    console.error(error.message, error.stack);
    process.exit(1);
});

// Set version of saved structures
Column.setJSONVersion(Version);

// Set timezone!
process.env.TZ = "UTC";

// Quick check
if (new Date().getTimezoneOffset() != 0) {
    throw new Error("Process should always run in UTC timezone");
}

const seeds = async () => {
    try {
        // Internal
        await Migration.runAll(__dirname + "/src/seeds");
    } catch (e) {
        console.error("Failed to run seeds:")
        console.error(e)
    }
};


const start = async () => {
    loadLogger();
    await I18n.load()
    
    const router = new Router();
    await router.loadAllEndpoints(__dirname + "/src/endpoints/*");
    router.endpoints.push(new CORSPreflightEndpoint())

    const routerServer = new RouterServer(router);
    routerServer.verbose = false

    // Log requests and errors
    routerServer.addRequestMiddleware(LogMiddleware)
    routerServer.addResponseMiddleware(LogMiddleware)

    // Add version headers and minimum version
    const versionMiddleware = new VersionMiddleware({
        latestVersions: {
            android: STAMHOOFD.LATEST_ANDROID_VERSION,
            ios: STAMHOOFD.LATEST_IOS_VERSION,
            web: Version
        },
        minimumVersion: 203
    })
    routerServer.addRequestMiddleware(versionMiddleware)
    routerServer.addResponseMiddleware(versionMiddleware)

    // Add CORS headers
    routerServer.addResponseMiddleware(CORSMiddleware)

    routerServer.listen(STAMHOOFD.PORT ?? 9090);

    const cronInterval = setInterval(() => {
        crons()
    }, 5 * 60 * 1000);
    crons()
    seeds().catch(console.error);
    
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
            while (areCronsRunning()) {
                console.log("Crons are still running. Waiting 2 seconds...")
                await sleep(2000)
            }
        } catch (err) {
            console.error("Failed to wait for crons to finish:");
            console.error(err);
        }

        try {
            await routerServer.close()
            console.log("HTTP server stopped");
        } catch (err) {
            console.error("Failed to stop HTTP server:");
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
