import { Member } from "@/shared/models/Member";
import { Filter } from "./Filter";
import { RecordType } from "@/shared/models/RecordType";

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
