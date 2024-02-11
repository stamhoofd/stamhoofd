require('@stamhoofd/backend-env').load({path: __dirname+'/../../.env.test.json'})

import { Database, Migration } from "@simonbackx/simple-database";
import path from "path";
const emailPath = require.resolve("@stamhoofd/email")
const modelsPath = require.resolve("@stamhoofd/models")
import nock from "nock";

// Disable network requests
nock.disableNetConnect()

// Set timezone!
process.env.TZ = "UTC";

// Quick check
if (new Date().getTimezoneOffset() != 0) {
    throw new Error("Process should always run in UTC timezone");
}

export default async () => {
    // External migrations
    await Migration.runAll(path.dirname(modelsPath) + "/migrations");
    await Migration.runAll(path.dirname(emailPath) + "/migrations");
    await Database.end();
};
