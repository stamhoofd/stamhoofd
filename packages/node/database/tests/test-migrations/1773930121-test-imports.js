// Exercise the built package export as a real consumer migration does.
// eslint-disable-next-line stamhoofd/no-package-self-import
import { Migration } from '@node/database';

export default new Migration(async () => {
    process.stdout.write('\n');
    console.log('ESM migrations supported');
    return Promise.resolve();
});
