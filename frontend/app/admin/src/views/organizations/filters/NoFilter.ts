
import { Filter } from "./Filter";

export class NoFilter implements Filter {
    getName(): string {
        return "Alle verenigingen";
    }
    doesMatch(): boolean {
        return true;
    }
}
