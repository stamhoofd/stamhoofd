import { SimpleError } from "@simonbackx/simple-errors";
import { Gender } from "@stamhoofd/structures";
import XLSX from "xlsx";

import { ColumnMatcher } from "../ColumnMatcher";
import { ImportingMember } from "../ImportingMember";
import { MatcherCategory } from "../MatcherCategory";

export class MemberNumberColumnMatcher implements ColumnMatcher {
    id = "MemberNumberColumnMatcher"
    category: MatcherCategory = MatcherCategory.Member

    getName(): string {
        return "Lidnummer"
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()

        const possibleMatch = ["lidnummer", "member number", "identifier"]

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return true
            }
        }

        if (cleaned == "id") {
            // should be an exact match, since it is too short
            return true
        }
        return false
    }

    apply(cell: XLSX.CellObject | undefined, member: ImportingMember) {
        if (!cell) {
            return
        }
        
        const value = ((cell.w ?? cell.v)+"").trim()
        member.details.memberNumber = value
    }
}