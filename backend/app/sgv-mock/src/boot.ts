import {
    CORSPreflightEndpoint,
    Request,
    Router,
    RouterServer,
} from "@simonbackx/simple-endpoints";

process.on("unhandledRejection", (error: Error) => {
    console.error("unhandledRejection");
    console.error(error.message, error.stack);
    process.exit(1);
});

process.env.TZ = "UTC";

if (new Date().getTimezoneOffset() !== 0) {
    throw new Error("Process should always run in UTC timezone");
}

// SGV is an external API and callers do not send Stamhoofd's X-Version header.
Request.defaultVersion = 1;

/** Starts the standalone SGV mock server with permissive CORS so dashboard and Playwright runs can call it as an external API. */
const start = async () => {
    const router = new Router();
    await router.loadEndpoints(import.meta.dirname + "/endpoints");
    router.endpoints.push(new CORSPreflightEndpoint());

    const routerServer = new RouterServer(router);
    routerServer.verbose = false;
    routerServer.defaultHeaders = {
        ...routerServer.defaultHeaders,
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
        "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    };

    const port = Number.parseInt(
        process.env.PORT ?? process.env.STAMHOOFD_PORT ?? "9094",
        10,
    );
    routerServer.listen(port);
    console.log(`Started SGV mock on port ${port}.`);

    const shutdown = async () => {
        console.log("Shutting down SGV mock...");
        routerServer.defaultHeaders = Object.assign(
            routerServer.defaultHeaders,
            { Connection: "close" },
        );
        await routerServer.close();
        process.exit(0);
    };

    process.on("SIGTERM", () => {
        shutdown().catch((error) => {
            console.error(error);
            process.exit(1);
        });
    });

    process.on("SIGINT", () => {
        shutdown().catch((error) => {
            console.error(error);
            process.exit(1);
        });
    });
};

start().catch((error) => {
    console.error("unhandledRejection", error);
    process.exit(1);
});
