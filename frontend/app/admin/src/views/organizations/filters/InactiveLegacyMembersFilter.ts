import { OrganizationOverview, STPackageType } from "@stamhoofd/structures";

import { Filter } from "./Filter";

export class InactiveLegacyMembersFilter implements Filter {
    getName(): string {
        return "Inactief + ledenadministratie zonder activiteiten";
    }
    doesMatch(organization: OrganizationOverview): boolean {
        return (organization.stats.memberCount < 10 && organization.stats.orderCount == 0 && organization.stats.activeAdmins == 0) && (organization.packages.isActive(STPackageType.LegacyMembers) && ! organization.packages.isActive(STPackageType.Members))
    }
}
