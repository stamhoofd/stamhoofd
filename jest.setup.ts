import { Database } from "./src/database/classes/Database";

console.log = jest.fn()
afterAll(async () => {
    await Database.end();
});