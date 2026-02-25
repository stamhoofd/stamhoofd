import { registerCron } from '@stamhoofd/crons';
import { FlagMomentCleanup } from '../helpers/FlagMomentCleanup.js';
import { Platform, RegistrationPeriod } from '@stamhoofd/models';

// Only delete responsibilities when the server is running during a month change.
// Chances are almost zero that we reboot during a month change
// Running on every reboot also would have unintended consequences
const now = new Date();
let lastCleanupYear: number = now.getFullYear();
let lastCleanupMonth: number = now.getMonth();

registerCron('endFunctionsOfUsersWithoutRegistration', endFunctionsOfUsersWithoutRegistration);

export async function endFunctionsOfUsersWithoutRegistration() {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    if (lastCleanupMonth === currentMonth && currentYear === lastCleanupYear) {
        return;
    }

    // Check if the current period is active for more than 2 months
    const platform = await Platform.getShared();
    const period = await RegistrationPeriod.getByID(platform.periodId);
    if (!period) {
        console.warn('No active registration period found, skipping cleanup.');
        return;
    }

    if (period.startDate > new Date(Date.now() - 1000 * 60 * 60 * 24 * 55)) {
        console.warn('Current registration period is less than 2 months old, skipping cleanup.');
        return;
    }

    // If period is ending within 15 days, also skip cleanup
    if (period.endDate && period.endDate < new Date(Date.now() + 1000 * 60 * 60 * 24 * 15)) {
        console.warn('Current registration period is ending within 15 days or has ended, skipping cleanup.');
        return;
    }

    await FlagMomentCleanup.endFunctionsOfUsersWithoutRegistration();
    lastCleanupYear = currentYear;
    lastCleanupMonth = currentMonth;
}
