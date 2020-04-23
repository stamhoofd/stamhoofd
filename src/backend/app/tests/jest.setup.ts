import { Database } from "@stamhoofd-backend/database";

console.log = jest.fn();
afterAll(async () => {
    await Database.end();
});
