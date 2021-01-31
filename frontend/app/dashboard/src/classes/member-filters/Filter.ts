import { MemberWithRegistrations, Organization } from '@stamhoofd/structures';

export interface Filter {
    getName(): string;
    doesMatch(member: MemberWithRegistrations, organization: Organization): boolean;
}

export interface DescriptiveFilter {
    getDescription(member: MemberWithRegistrations, organization: Organization): string;
}
