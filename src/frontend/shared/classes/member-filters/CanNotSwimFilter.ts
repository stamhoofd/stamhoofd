import { Member } from "@stamhoofd/shared/models/Member";
import { RecordType } from "@stamhoofd/shared/models/RecordType";

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
