import { Migration } from '@simonbackx/simple-database';
import { Registration } from '@stamhoofd/models';
import { RegistrationService } from '../services/RegistrationService.js';

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }

    if (STAMHOOFD.userMode !== 'platform') {
        console.log('skipped seed schedule-stock-updates because usermode not platform');
        return;
    }

    process.stdout.write('\n');
    let c = 0;
    let id: string = '';

    while (true) {
        const rawRegistrations = await Registration.where({
            id: {
                value: id,
                sign: '>',
            },
        }, { limit: 100, sort: ['id'] });

        const registrations = await Registration.getByIDs(...rawRegistrations.map(g => g.id));

        for (const registration of registrations) {
            RegistrationService.scheduleStockUpdate(registration.id);

            c++;

            if (c % 1000 === 0) {
                process.stdout.write('.');
            }
            if (c % 10000 === 0) {
                process.stdout.write('\n');
            }
        }

        if (registrations.length === 0) {
            break;
        }

        id = registrations[registrations.length - 1].id;
    }

    // Do something here
    return Promise.resolve();
});
