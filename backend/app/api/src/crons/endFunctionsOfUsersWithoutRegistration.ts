import { registerCron } from '@stamhoofd/crons';
import { FlagMomentCleanup } from '../helpers/FlagMomentCleanup';

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

    await FlagMomentCleanup.endFunctionsOfUsersWithoutRegistration();
    lastCleanupYear = currentYear;
    lastCleanupMonth = currentMonth;
}
