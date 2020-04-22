import { Migration } from "@stamhoofd-backend/database";
import { Database } from "@stamhoofd-backend/database";

export default new Migration(async () => {
    await Database.statement("select * from members limit 1");
});
