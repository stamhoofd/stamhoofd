import { SimpleError } from "@simonbackx/simple-errors";
import { Group, Parent, ParentType } from "@stamhoofd/structures";
import { StringCompare } from "@stamhoofd/utility";
import XLSX from "xlsx";

import { ColumnMatcher } from "../ColumnMatcher";
import { ImportingMember } from "../ImportingMember";
import { MatcherCategory } from "../MatcherCategory";
import { SharedMatcher } from "../SharedMatcher";

export class GroupColumnMatcher implements ColumnMatcher {
    id = "GroupColumnMatcher"
    category: MatcherCategory = MatcherCategory.Member

    getName(): string {
        return "Leeftijdsgroep"
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()

        const possibleMatch = ["groep", "tak", "indeling", "categorie", "ploeg"]

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return true
            }
        }
        return false
    }

    apply(cell: XLSX.CellObject | undefined, member: ImportingMember) {
        if (!cell) {
            throw new SimpleError({
                code: "invalid_type",
                message: "Deze leeftijdsgroep is leeg"
            })
        }
        
        // Check if string value
        if (cell.t != "s" || typeof cell.v !== "string" || !cell.v) {
            throw new SimpleError({
                code: "invalid_type",
                message: "De leeftijdsgroep is leeg"
            })
        }

        const value = cell.v
        let minErrorGroup: Group | null = null
        const minError = 0

        for (const group of member.organization.groups) {
            const err = StringCompare.typoCount(group.settings.name, value)
            if (err < 2 && minErrorGroup === null || err < minError) {
                minErrorGroup = group
            }
        }
        member.registration.group = minErrorGroup

        if (!minErrorGroup) {
            throw new SimpleError({
                code: "invalid_type",
                message: "'"+ value +"' is geen geldige leeftijdsgroep (deze bestaat niet in Stamhoofd). Zorg dat deze overeenkomt met de namen in Stamhoofd.",
            })
        }
    }
}