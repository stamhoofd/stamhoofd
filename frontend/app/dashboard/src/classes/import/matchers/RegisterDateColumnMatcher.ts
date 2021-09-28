import { Formatter } from "@stamhoofd/utility";
import XLSX from "xlsx";

import { DateColumnMatcher } from "../DateColumnMatcher";
import { ImportingMember } from "../ImportingMember";
import { MatcherCategory } from "../MatcherCategory";

export class RegisterDateColumnMatcher extends DateColumnMatcher {
    category: MatcherCategory = MatcherCategory.Member

    getName(): string {
        return "Datum van inschrijving"
    }

    get id() {
        return this.getName()+"-"+this.category
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()

        const negativeMatch = ["geboortedatum", "verjaardag", "birth day"]

        for (const word of negativeMatch) {
            if (cleaned.includes(word)) {
                return false
            }
        }

        const possibleMatch = ["datum", "date"]

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                return true
            }
        }
        return false
    }

    apply(cell: XLSX.CellObject | undefined, member: ImportingMember) {
        const date = this.dateFromCell(cell)
        if (date) {
            member.registration.date = date
        } else {
            member.registration.date = null
        }
    }
}