import { SimpleError } from "@simonbackx/simple-errors";
import XLSX from "xlsx";

import { ColumnMatcher } from "./ColumnMatcher";
import { ImportingMember } from "./ImportingMember";
import { SharedMatcher } from "./SharedMatcher";

export abstract class GeneralMatcher<T> extends SharedMatcher implements ColumnMatcher {
    name: string;
    required = false
    
    get?: (member: ImportingMember) => T|undefined
    save: (value: T, member: ImportingMember) => void

    constructor({name, category, required, possibleMatch, negativeMatch, save, get}: {
        name: string, 
        category: string, 
        required?: boolean, 
        possibleMatch?: string[], 
        negativeMatch?: string[], 
        save: (value: T, member: ImportingMember) => void,
        get?: (member: ImportingMember) => T|undefined
    }) {
        super(category)
        this.name = name
        this.required = required ?? false
        this.possibleMatch = possibleMatch ?? []
        this.negativeMatch = negativeMatch ?? []
        this.save = save
        this.get = get
    }

    getName(): string {
        return this.name;
    }

    get id() {
        return this.getName()+"-"+this.category
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        if (super.doesMatch(columnName, examples)) {
            return true
        }

        const nameCleaned = this.name.trim().toLowerCase()
        const nameCleanedWithoutBrackets = nameCleaned.replace(/\(.*\)/g, "").trim()

        if (columnName.trim().toLowerCase().includes(nameCleanedWithoutBrackets)) {
            return true
        }

        return false
    }

    apply(cell: XLSX.CellObject | undefined, member: ImportingMember) {
        if (!cell && this.required) {
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
            if (this.required) {
                throw new SimpleError({
                    code: "invalid_type",
                    message: "Deze cel is leeg"
                })
            }
            // Not required field
            return;
        }

        const value = this.parse(v, this.get ? this.get(member) : undefined)
        this.save(value, member)
    }

    abstract parse(v: string, current: T|undefined): T
}
