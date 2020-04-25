import { Database } from "@stamhoofd-backend/database";
import { Router } from "@stamhoofd-backend/routing";
import { RouterServer } from "@stamhoofd-backend/routing";

process.on("unhandledRejection", (error: Error) => {
    console.error("unhandledRejection");
    console.error(error.message, error.stack);
    process.exit(1);
});

// Set timezone!
process.env.TZ = "UTC";
require('dotenv').config()

// Quick check
if (new Date().getTimezoneOffset() != 0) {
    throw new Error("Process should always run in UTC timezone");
}

const start = async () => {
    const router = new Router();
    await router.loadAllEndpoints(__dirname + "/src");

    const routerServer = new RouterServer(router);
    routerServer.listen(9090);

    const shutdown = () => {
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
                    });
            })
            .catch(err => {
                console.error(err);
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
