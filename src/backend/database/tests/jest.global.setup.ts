import { Database } from "@stamhoofd-backend/database";

export default async () => {
    await Database.delete("DELETE FROM `_testModels_testModels`");
    await Database.delete("DELETE FROM `testModels`");
    await Database.end();
};
