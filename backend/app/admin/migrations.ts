require('@stamhoofd/backend-env').load()
import { Column, Migration } from "@simonbackx/simple-database";
import { Version } from "@stamhoofd/structures";
Column.setJSONVersion(Version);
process.env.TZ = "UTC";

// Validate UTC timezone
if (new Date().getTimezoneOffset() != 0) {
    throw new Error("Process should always run in UTC timezone");
}

const start = async () => {
    // We currently have no migrations in api
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
