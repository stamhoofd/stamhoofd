import { FlagMomentCleanup } from '../helpers/FlagMomentCleanup';

let lastCleanupYear: number = -1;
let lastCleanupMonth: number = -1;

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
