import { Member } from "@stamhoofd-frontend/models";
import { MemberWithRegistrations } from '@stamhoofd/structures';

export interface Filter {
    getName(): string;
    doesMatch(member: MemberWithRegistrations): boolean;
}
