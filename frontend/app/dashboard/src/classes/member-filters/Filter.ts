import { MemberWithRegistrations } from '@stamhoofd/structures';

export interface Filter {
    getName(): string;
    doesMatch(member: MemberWithRegistrations): boolean;
}

export interface DescriptiveFilter {
    getDescription(member: MemberWithRegistrations): string;
}
