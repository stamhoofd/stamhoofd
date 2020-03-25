import { Member } from "shared/models/Member";
import { Filter } from "./Filter";

export class NoFilter implements Filter {
    getName(): string {
        return "Alle leden";
    }
    doesMatch(member: Member): boolean {
        return true;
    }
}
