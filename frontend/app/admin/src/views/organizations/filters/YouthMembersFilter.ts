import { OrganizationOverview, OrganizationType } from "@stamhoofd/structures";

import { Filter } from "./Filter";

export class YouthMembersFilter implements Filter {
    getName(): string {
        return "Jeugdbeweging met ledenadministratie actief";
    }
    doesMatch(organization: OrganizationOverview): boolean {
        return organization.packages.useMembers && organization.stats.memberCount > 5 && organization.type === OrganizationType.Youth
    }
}
