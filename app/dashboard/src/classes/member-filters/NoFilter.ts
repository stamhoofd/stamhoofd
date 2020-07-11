import { Member } from "@stamhoofd-frontend/models";

import { Filter } from "./Filter";

export class NoFilter implements Filter {
    getName(): string {
        return "Alle leden";
    }
    doesMatch(_member: Member): boolean {
        return true;
    }
}
