import { LegacyRecordType,MemberWithRegistrations } from '@stamhoofd/structures';

import { Filter } from "./Filter";

export class CanNotSwimFilter implements Filter {
    getName(): string {
        return "Kan niet zwemmen";
    }
    doesMatch(member: MemberWithRegistrations): boolean {
        if (!member.details) {
            return false;
        }
        return member.details.records.some((record) => {
            return record.type == LegacyRecordType.CanNotSwim;
        });
    }
}
