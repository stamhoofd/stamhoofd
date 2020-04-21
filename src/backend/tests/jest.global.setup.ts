// For an unknown reason, the jest moduleDirectories etc is not working in global setup...
// So we need to apply tsconfig-paths/register
require("tsconfig-paths/register");
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
