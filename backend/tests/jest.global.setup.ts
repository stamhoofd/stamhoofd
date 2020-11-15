import { Database, Migration } from "@simonbackx/simple-database";

import { User } from "../src/models/User";

export default async () => {
    await Migration.runAll(__dirname + "/../src/migrations");
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
