import { Migration } from '@simonbackx/simple-database';
import { logger } from '@simonbackx/simple-logging';
import { BalanceItem, Registration } from '@stamhoofd/models';
import { Formatter } from '@stamhoofd/utility';

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
            const items = await BalanceItem.where({
                id: {
                    value: id,
                    sign: '>',
                },
                registrationId: {
                    value: null,
                    sign: '!=',
                },
                payingOrganizationId: {
                    value: null,
                    sign: '!=',
                },
            }, { limit: 1000, sort: ['id'] });

            if (items.length === 0) {
                break;
            }

            process.stdout.write('.');

            const registrationIds = Formatter.uniqueArray(items.map(i => i.registrationId!));
            const registrations = await Registration.getByIDs(...registrationIds);

            for (const item of items) {
                if (!item.registrationId || !item.payingOrganizationId) {
                    continue;
                }
                const registration = registrations.find(r => r.id === item.registrationId);
                if (!registration) {
                    continue;
                }

                registration.payingOrganizationId = item.payingOrganizationId;
                if (await registration.save()) {
                    c++;
                }
            }

            if (items.length < 1000) {
                break;
            }
            id = items[items.length - 1].id;
        }
    });

    console.log('Updated ' + c + ' registrations');

    // Do something here
    return Promise.resolve();
});
