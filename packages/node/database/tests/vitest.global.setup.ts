// First dotenv
import 'dotenv/config';

function getDirname(): string {
    // CJS environment
    if (typeof __dirname !== 'undefined') {
        return __dirname;
    }
    // ESM environment
    // @ts-ignore
    if (typeof import.meta !== 'undefined' && import.meta.url) {
        // @ts-ignore
        return dirname(fileURLToPath(import.meta.url));
    }
    throw new Error('Cannot determine __dirname');
}

// Continue
import { Database } from '../src/classes/Database.js';
import { Migration } from '../src/classes/Migration.js';

export async function setup() {
    await Migration.runAll(getDirname() + '/test-migrations');

    await Database.delete('DELETE FROM `_testModels_testModels`');
    await Database.delete('DELETE FROM `testModels`');
    await Database.end();
};
