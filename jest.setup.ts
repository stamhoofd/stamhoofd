import { Database } from "./src/database/classes/Database";

afterAll(async () => {
    await Database.end();
});