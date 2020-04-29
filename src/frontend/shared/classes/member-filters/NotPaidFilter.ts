import { Member } from "@stamhoofd-frontend/models";

import { Filter } from "./Filter";

export class NotPaidFilter implements Filter {
    getName(): string {
        return "Nog niet betaald";
    }
    doesMatch(member: Member): boolean {
        return !member.paid;
    }
}
