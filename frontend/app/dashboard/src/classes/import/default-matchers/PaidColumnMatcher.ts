import { SimpleError } from "@simonbackx/simple-errors";
import XLSX from "xlsx";

import { ColumnMatcher } from "../ColumnMatcher";
import { ImportingMember } from "../ImportingMember";
import { MatcherCategory } from "../MatcherCategory";

export class PaidColumnMatcher implements ColumnMatcher {
    id = "PaidColumnMatcher"
    category: MatcherCategory = MatcherCategory.Payment

    getName(): string {
        return "Betaald (ja/nee)"
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()

        const possibleMatch = ["betaald", "paid", "payment"]

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return this.areBooleanValues(examples)
            }
        }
        return false
    }

    castBoolean(value: string) {
        if (value.length == 0) {
            return false
        }

        if (value.toLowerCase() === "x") {
            return true
        }

        if (value.toLowerCase() === "1") {
            return true
        }

        if (value.toLowerCase() === "0") {
            return false
        }

        if (value.toLowerCase() === "ja") {
            return true
        }

        if (value.toLowerCase() === "nee") {
            return false
        }

        if (value.toLowerCase() === "yes") {
            return true
        }

        if (value.toLowerCase() === "no") {
            return false
        }

        if (value.toLowerCase() === "true") {
            return true
        }

        if (value.toLowerCase() === "false") {
            return false
        }

        if (value.toLowerCase() === "betaald") {
            return true
        }

        if (value.toLowerCase() === "nog niet betaald") {
            return false
        }
        
        if (value.toLowerCase() === "niet betaald") {
            return false
        }

        return null
    }

    areBooleanValues(examples: string[]) {
        for (const example of examples) {
            const b = this.castBoolean(example)
            if (b === null) {
                return false
            }
        }
        return true
    }

    apply(cell: XLSX.CellObject | undefined, member: ImportingMember) {
        if (!cell) {
            member.registration.paid = false
            return
        }

        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        const value = ((cell.w ?? cell.v)+"").toLowerCase().trim()
        const b = this.castBoolean(value)
        
        if (b === null) {
            throw new SimpleError({
                code: "invalid_type",
                message: "'"+ value +"' is geen ja of nee. Probeer Ja of Nee, X, 0, 1 of leeg",
            })
        }

        member.registration.paid = b
    }
}