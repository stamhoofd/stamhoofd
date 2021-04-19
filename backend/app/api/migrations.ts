require('dotenv').config()
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
    // We currently have no migrations in api
    //await Migration.runAll(__dirname + "/src/migrations");

    // External migrations
    await Migration.runAll(path.dirname(modelsPath) + "/migrations");
    await Migration.runAll(path.dirname(emailPath) + "/migrations");
};

start()
    .catch(error => {
        console.error("unhandledRejection", error);
        process.exit(1);
    })
    .finally(() => {
        process.exit();
    });
