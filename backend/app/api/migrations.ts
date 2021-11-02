require('@stamhoofd/backend-env').load()
import { Column, Migration } from "@simonbackx/simple-database";
import { Version } from "@stamhoofd/structures";
import path from "path";

Column.jsonVersion = Version
process.env.TZ = "UTC";

const emailPath = require.resolve("@stamhoofd/email")
const modelsPath = require.resolve("@stamhoofd/models")

// Validate UTC timezone
if (new Date().getTimezoneOffset() != 0) {
    throw new Error("Process should always run in UTC timezone");
}

const start = async () => {
    // External migrations
    await Migration.runAll(path.dirname(modelsPath) + "/migrations");
    await Migration.runAll(path.dirname(emailPath) + "/migrations");

    // Internal
    await Migration.runAll(__dirname + "/src/migrations");
};

start()
    .catch(error => {
        console.error("unhandledRejection", error);
        process.exit(1);
    })
    .finally(() => {
        process.exit();
    });
