import { Member } from "@stamhoofd-frontend/models";
import { RecordType } from "@stamhoofd-frontend/models";

import { Filter } from "./Filter";

export class CanNotSwimFilter implements Filter {
    getName(): string {
        return "Kan niet zwemmen";
    }
    doesMatch(member: Member): boolean {
        return member.records.some((record) => {
            return record.type == RecordType.CanNotSwim;
        });
    }
}
