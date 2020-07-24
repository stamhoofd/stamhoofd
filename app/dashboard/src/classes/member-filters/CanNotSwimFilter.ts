import { Filter } from "./Filter";
import { DecryptedMember, RecordType } from '@stamhoofd/structures';

export class CanNotSwimFilter implements Filter {
    getName(): string {
        return "Kan niet zwemmen";
    }
    doesMatch(member: DecryptedMember): boolean {
        if (!member.details) {
            return false;
        }
        return member.details.records.some((record) => {
            return record.type == RecordType.CanNotSwim;
        });
    }
}
