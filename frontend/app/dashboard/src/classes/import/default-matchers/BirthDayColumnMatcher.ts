import XLSX from "xlsx";

import { DateColumnMatcher } from "../DateColumnMatcher";
import { ImportingMember } from "../ImportingMember";
import { MatcherCategory } from "../MatcherCategory";

export class BirthDayColumnMatcher extends DateColumnMatcher {
    category: MatcherCategory = MatcherCategory.Member

    getName(): string {
        return "Geboortedatum"
    }

    get id() {
        return this.getName()+"-"+this.category
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()

        const possibleMatch = ["geboortedatum", "verjaardag", "birth day"]

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return true
            }
        }
        return false
    }

    apply(cell: XLSX.CellObject | undefined, member: ImportingMember) {
        member.details.birthDay = this.dateFromCell(cell) ?? null
    }
}