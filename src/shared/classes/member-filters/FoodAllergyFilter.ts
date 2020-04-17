import { Member } from "@/shared/models/Member";
import { Filter } from "./Filter";
import { RecordType } from "@/shared/models/RecordType";

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
