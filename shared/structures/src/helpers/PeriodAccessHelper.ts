import type { LoadedPermissions } from '../LoadedPermissions.js';
import type { OrganizationRegistrationPeriod } from '../RegistrationPeriod.js';

export class PeriodAccessHelper {
    /**
     * Whether an admin can open a given period: group and category permissions are period specific,
     * so a role only reaches the periods it was granted groups in.
     */
    static isPeriodAccessible(period: OrganizationRegistrationPeriod, permissions: LoadedPermissions | null): boolean {
        if (!permissions) {
            return false;
        }

        if (permissions.hasFullAccess()) {
            return true;
        }

        return period.getCategoryTree({ permissions }).getAllGroups().length > 0;
    }
}
