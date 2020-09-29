import { MemberWithRegistrations } from '@stamhoofd/structures';

import { Filter } from "./Filter";

export class NotPaidFilter implements Filter {
    getName(): string {
        return "Nog niet betaald";
    }
    doesMatch(member: MemberWithRegistrations): boolean {
        return !member.paid;
    }
}
