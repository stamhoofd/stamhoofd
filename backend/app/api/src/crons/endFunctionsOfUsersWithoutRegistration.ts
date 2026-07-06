import { registerCron } from '@stamhoofd/crons';
import { Formatter } from '@stamhoofd/utility';
import { FlagMomentCleanup } from '../helpers/FlagMomentCleanup.js';

// Only run the cleanup once per calendar day (crons tick every 5 minutes).
let lastRunDay: string | null = null;

registerCron('endFunctionsOfUsersWithoutRegistration', endFunctionsOfUsersWithoutRegistration);

export async function endFunctionsOfUsersWithoutRegistration() {
    const today = Formatter.dateIso(new Date());
    if (lastRunDay === today) {
        return;
    }
    lastRunDay = today;

    await FlagMomentCleanup.endResponsibilitiesOfUnregisteredMembers();
}
