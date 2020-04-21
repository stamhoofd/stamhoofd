import { Migration } from "@stamhoofd/backend/src/database/classes/Migration";
import { Database } from "@stamhoofd/backend/src/database/classes/Database";

export default new Migration(async () => {
    await Database.statement("select * from members limit 1");
});
