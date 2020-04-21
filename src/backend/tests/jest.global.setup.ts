import { User } from "../src/users/models/User";
import { Database } from "../src/database/classes/Database";

export default async () => {
    await Database.delete("DELETE FROM " + User.table);
    await Database.delete("DELETE FROM `_testModels_testModels`");
    await Database.delete("DELETE FROM `testModels`");
    await Database.delete("DELETE FROM `tokens`");
    await Database.delete("DELETE FROM `users`");
    await Database.delete("DELETE FROM `members`");
    await Database.delete("DELETE FROM `organizations`");

    await Database.end();
};
