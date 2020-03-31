import { Member, FullyLoadedMember } from "./src/members/models/Member";
import { Address } from "./src/members/models/Address";
import { Parent } from "./src/members/models/Parent";
import { Router } from "./src/routing/classes/Router";
import { Request } from "./src/routing/classes/Request";
import { RouterServer } from "./src/routing/classes/RouterServer";
import { Database } from "./src/database/classes/Database";

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
    const router = new Router();
    await router.loadAllEndpoints(__dirname + "/src");

    const routerServer = new RouterServer(router);
    routerServer.listen(8080);

    process.on("SIGINT", () => {
        console.info("SIGINT signal received.");

        routerServer
            .close()
            .then(() => {
                console.log("Server stopped");

                Database.end()
                    .then(() => {
                        console.log("MySQL connections closed");

                        // Should not be needed, but added for security
                        process.exit();
                    })
                    .catch(err => {
                        console.error(err);
                    });
            })
            .catch(err => {
                console.error(err);
            });
    });
};

start().catch(error => {
    console.error("unhandledRejection", error);
    process.exit(1);
});
