import { Member } from "@stamhoofd-frontend/models";
import { RecordType } from "@stamhoofd-frontend/models";

import { Filter } from "./Filter";

export class FoodAllergyFilter implements Filter {
    getName(): string {
        return "Voedingsallergie";
    }
    doesMatch(member: Member): boolean {
        return member.records.some((record) => {
            return record.type == RecordType.FoodAllergies;
        });
    }
}
