import { Column,Database } from "@simonbackx/simple-database";
import { Request } from '@simonbackx/simple-endpoints';
import { Version } from '@stamhoofd/structures';

// Set version of saved structures
Column.jsonVersion = Version

// Automatically set endpoint default version to latest one (only in tests!)
Request.defaultVersion = Version

console.log = jest.fn();
afterAll(async () => {
    await Database.end();
});
