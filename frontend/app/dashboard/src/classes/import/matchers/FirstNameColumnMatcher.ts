import { SimpleError } from "@simonbackx/simple-errors";
import { Parent, ParentType } from "@stamhoofd/structures";
import XLSX from "xlsx";

import { ColumnMatcher } from "../ColumnMatcher";
import { ImportingMember } from "../ImportingMember";
import { MatcherCategory } from "../MatcherCategory";
import { SharedMatcher } from "../SharedMatcher";

export class FirstNameColumnMatcher extends SharedMatcher implements ColumnMatcher {
    getName(): string {
        return "Voornaam"
    }

    get id() {
        return this.getName()+"-"+this.category
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()

        for (const word of ["achternaam", "familienaam", "lastname", ...this.negativeMatch]) {
            if (cleaned.includes(word)) {
                return false
            }
        }
        
        const possibleMatch = ["voornaam", "firstname"]

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return true
            }
        }
        return false
    }

    apply(cell: XLSX.CellObject | undefined, member: ImportingMember) {
        if (!cell && this.category === MatcherCategory.Member) {
            throw new SimpleError({
                code: "invalid_type",
                message: "Deze cel is leeg"
            })
        }

        if (!cell) {
            return
        }

        const value = ((cell.w ?? cell.v)+"").trim()

        if (!value) {
            if (this.category === MatcherCategory.Member) {
                throw new SimpleError({
                    code: "invalid_type",
                    message: "Deze cel is leeg"
                })
            }
            // Not required field
            return;
        }

        if (this.category == MatcherCategory.Member) {
            member.details.firstName = value
        } else if (this.category == MatcherCategory.Parent1) {
            if (member.details.parents.length == 0) {
                member.details.parents.push(Parent.create({
                    type: ParentType.Parent1
                }))
            }
            member.details.parents[0].firstName = value
        } else if (this.category == MatcherCategory.Parent2) {
            while (member.details.parents.length < 2) {
                member.details.parents.push(Parent.create({
                    type: ParentType.Parent2
                }))
            }
            member.details.parents[1].firstName = value
        }
    }
}