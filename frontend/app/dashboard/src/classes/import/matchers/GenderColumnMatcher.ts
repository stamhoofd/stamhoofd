import { SimpleError } from "@simonbackx/simple-errors";
import { Gender } from "@stamhoofd/structures";
import XLSX from "xlsx";

import { ColumnMatcher } from "../ColumnMatcher";
import { ImportingMember } from "../ImportingMember";
import { MatcherCategory } from "../MatcherCategory";

export class GenderColumnMatcher implements ColumnMatcher {
    id = "GenderColumnMatcher"
    category: MatcherCategory = MatcherCategory.Member

    getName(): string {
        return "Geslacht"
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()

        const possibleMatch = ["geslacht", "gender", "sex"]

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
                message: "Deze cel is leeg"
            })
        }
        
        // Check if string value
        if (cell.t != "s" || typeof cell.v !== "string" || !cell.v) {
            throw new SimpleError({
                code: "invalid_type",
                message: "Geen tekst in deze cel"
            })
        }

        const value = cell.v.toLowerCase().trim()
        let gender = Gender.Other
        
        if (value.includes("jongen") || value.includes("boy") || (value.startsWith("m") && !value.includes("meisje"))) {
            gender = Gender.Male
        } else if (value.startsWith("v") || value.startsWith("f") || value.includes("meisje") || value.includes("girl")) {
            gender = Gender.Female
        } else if (value == "x") {
            gender = Gender.Other
        } else if (value != "") {
             throw new SimpleError({
                code: "invalid_type",
                message: "'"+ value +"' is geen geslacht dat we kunnen herkennen. Probeer M of V, Man, Vrouw, Jongen, Meisje... Laat leeg voor onbekend.",
            })
        }

        member.details.gender = gender
    }
}