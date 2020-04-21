import { Migration } from "./src/database/classes/Migration";

const start = async () => {
    await Migration.runAll(__dirname + "/src");
};

start()
    .catch(error => {
        console.error("unhandledRejection", error);
        process.exit(1);
    })
    .finally(() => {
        process.exit();
    });
