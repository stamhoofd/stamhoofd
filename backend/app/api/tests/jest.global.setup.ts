require('@stamhoofd/backend-env').load({path: __dirname+'/../../.env.test.json'})

import { Database, Migration } from "@simonbackx/simple-database";
const emailPath = require.resolve("@stamhoofd/email")
const modelsPath = require.resolve("@stamhoofd/models")
import { User } from "@stamhoofd/models";
import path from "path";

export default async () => {
    // External migrations
    await Migration.runAll(path.dirname(modelsPath) + "/migrations");
    await Migration.runAll(path.dirname(emailPath) + "/migrations");

    await Database.delete("DELETE FROM " + User.table);
    await Database.delete("DELETE FROM `tokens`");
    await Database.delete("DELETE FROM `users`");
    await Database.delete("DELETE FROM `registrations`");
    await Database.delete("DELETE FROM `payments`");
    await Database.delete("DELETE FROM `members`");
    await Database.delete("DELETE FROM `organizations`");

    await Database.delete("DELETE FROM `postal_codes`");
    await Database.delete("DELETE FROM `cities`");
    await Database.delete("DELETE FROM `provinces`");

    await Database.delete("OPTIMIZE TABLE organizations;"); // fix breaking of indexes due to deletes (mysql bug?)
    await Database.end();
};
