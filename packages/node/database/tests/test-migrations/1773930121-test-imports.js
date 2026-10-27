import { Migration } from '@simonbackx/simple-database';

export default new Migration(async () => {
    process.stdout.write('\n');
    console.log('ESM migrations supported');
    return Promise.resolve();
});
