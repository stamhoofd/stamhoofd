import { registerCron } from '@stamhoofd/crons';
import { FlagMomentCleanup } from '../helpers/FlagMomentCleanup.js';

// Only run the cleanup once per calendar day (crons tick every 5 minutes).
let lastRunDate: number | null = null;

registerCron('endFunctionsOfUsersWithoutRegistration', endFunctionsOfUsersWithoutRegistration);

function shouldRun() {
    const now = new Date();

    if (now.getDate() === lastRunDate) {
        return false;
    }

    const hour = now.getHours();

    // between 5 and 7 AM
    if (hour !== 5 && hour !== 6 && STAMHOOFD.environment !== 'development') {
        return false;
    }

    return true;
}

export async function endFunctionsOfUsersWithoutRegistration() {
    if (!shouldRun()) {
        return;
    }
    const now = new Date();
    lastRunDate = now.getDate();

    await FlagMomentCleanup.endResponsibilitiesOfUnregisteredMembers();
}
