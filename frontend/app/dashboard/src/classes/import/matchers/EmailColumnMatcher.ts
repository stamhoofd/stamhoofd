import { SimpleError } from "@simonbackx/simple-errors";
import { Parent, ParentType } from "@stamhoofd/structures";
import { DataValidator, Formatter } from "@stamhoofd/utility";
import XLSX from "xlsx";

import { ColumnMatcher } from "../ColumnMatcher";
import { ImportingMember } from "../ImportingMember";
import { MatcherCategory } from "../MatcherCategory";
import { SharedMatcher } from "../SharedMatcher";

export class EmailColumnMatcher extends SharedMatcher implements ColumnMatcher {
    getName(): string {
        return "E-mailadres"
    }

    get id() {
        return this.getName()+"-"+this.category
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()
        
        const possibleMatch = ["mail"]

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
            return
        }
        
        // Check if string value
        if (cell.t != "s" || typeof cell.v !== "string" || !cell.v) {
            throw new SimpleError({
                code: "invalid_type",
                message: "Geen tekst in deze cel"
            })
        }

        const email = cell.v.toLowerCase()
        if (!DataValidator.isEmailValid(email)) {
            throw new SimpleError({
                "code": "invalid_field",
                "message": "Ongeldig e-mailadres",
            })
        }

        if (this.category == MatcherCategory.Member) {
            member.details.email = email
        } else if (this.category == MatcherCategory.Parent1) {
            if (member.details.parents.length == 0) {
                member.details.parents.push(Parent.create({
                    type: ParentType.Parent1
                }))
            }
            member.details.parents[0].email = email
        } else if (this.category == MatcherCategory.Parent2) {
            while (member.details.parents.length < 2) {
                member.details.parents.push(Parent.create({
                    type: ParentType.Parent2
                }))
            }
            member.details.parents[1].email = email
        }
    }
}