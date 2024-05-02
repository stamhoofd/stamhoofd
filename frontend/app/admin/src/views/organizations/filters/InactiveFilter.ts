import { OrganizationOverview } from "@stamhoofd/structures";

import { Filter } from "./Filter";

export class InactiveFilter implements Filter {
    getName(): string {
        return "Inactief";
    }
    doesMatch(organization: OrganizationOverview): boolean {
        return organization.stats.memberCount < 10 && organization.stats.orderCount == 0 && organization.stats.activeAdmins == 0
    }
}
