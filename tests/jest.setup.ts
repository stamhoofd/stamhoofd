import { Database } from "@simonbackx/simple-database";

console.log = jest.fn();
afterAll(async () => {
    await Database.end();
});
