import { User } from "../src/users/models/User";
import { Database } from "../src/database/classes/Database";

export default async () => {
    await Database.delete("DELETE FROM " + User.table);
    await Database.end();
};
