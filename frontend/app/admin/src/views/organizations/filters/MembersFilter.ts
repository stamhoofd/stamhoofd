import { OrganizationOverview } from "@stamhoofd/structures";

import { Filter } from "./Filter";

export class MembersFilter implements Filter {
    getName(): string {
        return "Met ledenadministratie actief";
    }
    doesMatch(organization: OrganizationOverview): boolean {
        return organization.packages.useMembers && organization.stats.memberCount > 5
    }
}
