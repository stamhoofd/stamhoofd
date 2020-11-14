require('dotenv').config()
import { Migration } from "@simonbackx/simple-database";

const start = async () => {
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
