import { DecryptedMember } from '@stamhoofd/structures';

import { Filter } from "./Filter";

export class NotPaidFilter implements Filter {
    getName(): string {
        return "Nog niet betaald";
    }
    doesMatch(member: DecryptedMember): boolean {
        return !member.paid;
    }
}
