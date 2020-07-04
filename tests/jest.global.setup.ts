import { Database } from "@simonbackx/simple-database";

import { User } from "../src/models/User";

export default async () => {
    await Database.delete("DELETE FROM " + User.table);
    await Database.delete("DELETE FROM `tokens`");
    await Database.delete("DELETE FROM `users`");
    await Database.delete("DELETE FROM `members`");
    await Database.delete("DELETE FROM `organizations`");

    await Database.end();
};
