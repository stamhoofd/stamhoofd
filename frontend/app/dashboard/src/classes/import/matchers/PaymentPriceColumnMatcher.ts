import { SimpleError } from "@simonbackx/simple-errors";
import XLSX from "xlsx";

import { ColumnMatcher } from "../ColumnMatcher";
import { ImportingMember } from "../ImportingMember";
import { MatcherCategory } from "../MatcherCategory";

export class PaymentPriceColumnMatcher implements ColumnMatcher {
    id = "PaymentPriceColumnMatcher"
    category: MatcherCategory = MatcherCategory.Payment

    getName(): string {
        return "Bedrag (al dan niet betaald)"
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()

        const possibleMatch = ["lidgeld", "price"]

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return this.areNumbersValues(examples)
            }
        }
        return false
    }

    areNumbersValues(examples: string[]) {
        for (const example of examples) {
            if (isNaN(parseFloat(example.toLowerCase().replace(/[€$\s,]+/g, "").trim()))) {
                return false
            }
        }
        return true
    }

    apply(cell: XLSX.CellObject | undefined, member: ImportingMember) {
        if (!cell) {
            throw new SimpleError({
                code: "invalid_type",
                message: "Deze cel is leeg"
            })
        }

        // Check if string value
        // eslint-disable-next-line @typescript-eslint/restrict-plus-operands
        const value = ((cell.w ?? cell.v)+"").toLowerCase().replace(/[€$\s,]+/g, "").trim().trim()
        const b = parseFloat(value)
        
        if (isNaN(b)) {
            throw new SimpleError({
                code: "invalid_type",
                message: "'"+ value +"' is geen geldig bedrag",
            })
        }

        if (Math.floor(b*100) !== b*100 ) {
            throw new SimpleError({
                code: "invalid_type",
                message: "'"+ value +"' bevat te veel cijfers na de komma",
            })
        }

        member.registration.price = Math.floor(b * 100)
    }
}