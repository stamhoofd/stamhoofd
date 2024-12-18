import { Migration } from '@simonbackx/simple-database';
import { logger } from '@simonbackx/simple-logging';
import { Platform, RegistrationPeriod } from '@stamhoofd/models';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    process.stdout.write('\n');
    let c = 0;
    let id: string = '';

    await logger.setContext({ tags: ['seed'] }, async () => {
        while (true) {
            const items = await RegistrationPeriod.where({
                id: {
                    value: id,
                    sign: '>',
                },
            }, { limit: 1000, sort: ['id'] });

            if (items.length === 0) {
                break;
            }

            process.stdout.write('.');

            for (const item of items) {
                await item.setPreviousPeriodId();
                if (await item.save()) {
                    c += 1;
                }
            }

            if (items.length < 1000) {
                break;
            }
            id = items[items.length - 1].id;
        }
    });

    console.log('Updated ' + c + ' registration periods');

    // Now update platform
    const platform = await Platform.getShared();
    await platform.setPreviousPeriodId();
    await platform.save();

    console.log('Updated platform');

    // Do something here
    return Promise.resolve();
});
