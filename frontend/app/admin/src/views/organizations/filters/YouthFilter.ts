import { OrganizationOverview, OrganizationType } from "@stamhoofd/structures";

import { Filter } from "./Filter";

export class YouthFilter implements Filter {
    getName(): string {
        return "Jeugdbeweging";
    }
    doesMatch(organization: OrganizationOverview): boolean {
        return organization.type === OrganizationType.Youth
    }
}
