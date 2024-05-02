import { OrganizationOverview } from '@stamhoofd/structures';

export interface Filter {
    getName(): string;
    doesMatch(organization: OrganizationOverview): boolean;
}