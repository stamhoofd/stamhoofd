import { registerCron } from '@stamhoofd/crons';
import { Organization } from '@stamhoofd/models';
import { isOutside } from './helpers/isOutside.js';
import { useSavedIterator } from './helpers/useSavedIterator.js';

const { iterate, isHoursAgo } = useSavedIterator(() => {
    return Organization.select();
}, { limit: 10, maxQueries: 5 });

async function checkDrips() {
    if (STAMHOOFD.environment === 'development') {
        // For now reenabled on development for testing
        // return;
    }

    if (STAMHOOFD.userMode === 'platform') {
        return;
    }

    // Only send emails between 8:00 - 18:00 CET
    if (isOutside('08:00', '18:00') && STAMHOOFD.environment === 'production') {
        console.log('Skip Drip check: outside hours');
        return;
    }

    if (!isHoursAgo(6)) {
        return;
    }

    // Get the next x organization to send e-mails for
    for await (const organization of iterate()) {
        try {
            await organization.checkDrips();
        } catch (e) {
            console.error(e);
        }
    }
}

if (STAMHOOFD.userMode !== 'platform') {
    registerCron('checkDrips', checkDrips);
}
