import { SimpleError } from "@simonbackx/simple-errors";
import { Parent, ParentType } from "@stamhoofd/structures";
import XLSX from "xlsx";

import { ColumnMatcher } from "../ColumnMatcher";
import { ImportingMember } from "../ImportingMember";
import { MatcherCategory } from "../MatcherCategory";
import { SharedMatcher } from "../SharedMatcher";

export class FullNameColumnMatcher extends SharedMatcher implements ColumnMatcher {
    getName(): string {
        return "Volledige naam"
    }

    get id() {
        return this.getName()+"-"+this.category
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase()

        for (const word of ["voornaam", "first", "achter", "last", ...this.negativeMatch]) {
            if (cleaned.includes(word)) {
                return false
            }
        }
        

        if (["volledige naam"].includes(cleaned)) {
            return true
        }

        const possibleMatch = ["naam", "name"]

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return this.doExamplesHaveFullNames(examples)
            }
        }
        return false
    }

    doExamplesHaveFullNames(examples: string[]): boolean {
        if (examples.length == 0) {
            return false
        }
        for (const example of examples) {
            if (!example.match(/\w\s+\w/g)) {
                return false
            }
        }
        return true
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

        const v = ((cell.w ?? cell.v)+"").trim()

        if (!v) {
            if (this.category === MatcherCategory.Member) {
                throw new SimpleError({
                    code: "invalid_type",
                    message: "Deze cel is leeg"
                })
            }
            // Not required field
            return;
        }

        // TODO: improve splitting
        let firstName = v.split(" ")[0]
        let lastName = v.substr(firstName.length+1)

        firstName = firstName.trim()
        lastName = lastName.trim()

        if (this.category == MatcherCategory.Member) {
            member.details.firstName = firstName
            member.details.lastName = lastName
        } else if (this.category == MatcherCategory.Parent1) {
            if (member.details.parents.length == 0) {
                member.details.parents.push(Parent.create({
                    type: ParentType.Parent1
                }))
            }
            member.details.parents[0].firstName = firstName
            member.details.parents[0].lastName = lastName
        } else if (this.category == MatcherCategory.Parent2) {
            while (member.details.parents.length < 2) {
                member.details.parents.push(Parent.create({
                    type: ParentType.Parent2
                }))
            }
            member.details.parents[1].firstName = firstName
            member.details.parents[1].lastName = lastName
        }
    }

}
