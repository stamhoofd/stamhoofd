require('dotenv').config()
import { Migration } from "@simonbackx/simple-database";
import { v4 as uuidv4 } from "uuid";

const start = async () => {
    await Migration.runAll(__dirname + "/src/migrations");
    console.log(uuidv4());
    console.log(uuidv4());
    console.log(uuidv4());
    console.log(uuidv4());
    console.log(uuidv4());
    console.log(uuidv4());
    console.log(uuidv4());
    console.log(uuidv4());
};

start()
    .catch(error => {
        console.error("unhandledRejection", error);
        process.exit(1);
    })
    .finally(() => {
        process.exit();
    });
