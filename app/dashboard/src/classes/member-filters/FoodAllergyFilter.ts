import { MemberWithRegistrations, RecordType } from '@stamhoofd/structures';

import { Filter } from "./Filter";

export class FoodAllergyFilter implements Filter {
    getName(): string {
        return "Voedingsallergie of dieet";
    }
    doesMatch(member: MemberWithRegistrations): boolean {
        if (!member.details) {
            return false;
        }

        return member.details.records.some((record) => {
            return record.type == RecordType.FoodAllergies || record.type == RecordType.Diet;
        });
    }
}
