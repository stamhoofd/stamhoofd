import { SimpleError } from "@simonbackx/simple-errors";
import { Address, Parent, ParentType } from "@stamhoofd/structures";
import { DataValidator, Formatter } from "@stamhoofd/utility";
import XLSX from "xlsx";

import { ColumnMatcher } from "../ColumnMatcher";
import { ImportingMember } from "../ImportingMember";
import { MatcherCategory } from "../MatcherCategory";
import { SharedMatcher } from "../SharedMatcher";

export class StreetWithNumberColumnMatcher extends SharedMatcher implements ColumnMatcher {
    getName(): string {
        return "Straat met huisnummer"
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()
        
        const possibleMatch = ["straat"]

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return this.doExamplesHaveNumbers(examples)
            }
        }
        return false
    }

    doExamplesHaveNumbers(examples: string[]): boolean {
        if (examples.length == 0) {
            return false
        }
        for (const example of examples) {
            if (!example.match(/^\s*([^0-9]+?)[\s,]*([0-9].*?)\s*$/g)) {
                return false
            }
        }
        return true
    }

    apply(cell: XLSX.CellObject, member: ImportingMember) {
        // Check if string value
        if (cell.t != "s" || typeof cell.v !== "string" || !cell.v) {
            throw new SimpleError({
                code: "invalid_type",
                message: "Geen tekst in deze cell"
            })
        }

        const { number, street } = Address.splitAddressLine(cell.v)

        if (this.category == MatcherCategory.Member) {
            if (!member.details.address) {
                member.details.address = Address.createDefault()
            }
            member.details.address.number = number
            member.details.address.street = street
        } else if (this.category == MatcherCategory.Parent1) {
            if (member.details.parents.length == 0) {
                member.details.parents.push(Parent.create({
                    type: ParentType.Parent1
                }))
            }

            if (!member.details.parents[0].address) {
                member.details.parents[0].address = Address.createDefault()
            }
            member.details.parents[0].address.number = number
            member.details.parents[0].address.street = street
        } else if (this.category == MatcherCategory.Parent2) {
            while (member.details.parents.length < 2) {
                member.details.parents.push(Parent.create({
                    type: ParentType.Parent2
                }))
            }
            if (!member.details.parents[1].address) {
                member.details.parents[1].address = Address.createDefault()
            }
            member.details.parents[1].address.number = number
            member.details.parents[1].address.street = street
        }
    }
}