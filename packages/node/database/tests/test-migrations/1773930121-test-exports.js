'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
const simple_database_1 = require('@simonbackx/simple-database');
exports.default = new simple_database_1.Migration(async () => {
    process.stdout.write('\n');
    console.log('CJS migrations supported');
    return Promise.resolve();
});
