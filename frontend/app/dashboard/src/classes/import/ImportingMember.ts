import { isSimpleError, isSimpleErrors } from "@simonbackx/simple-errors";
import { Group, MemberDetails, Organization } from "@stamhoofd/structures";
import XLSX from "xlsx";

import { MatchedColumn } from "./MatchedColumn";

export class ImportingRegistration {
    group: Group | null = null
    autoAssignedGroup: Group | null = null
    paid: boolean | null = null
}

export class ImportResult {
    errors: ImportError[] = []
    members: ImportingMember[] = []
}

export class ImportError {
    column: number
    row: number
    message: string

    constructor(row: number, column: number, message: string) {
        this.row = row
        this.column = column
        this.message = message
    }

    get cellPath(): string {
        return XLSX.utils.encode_cell({ r: this.row, c: this.column })
    }
}

export class ImportingMember {
    row = 0
    details = new MemberDetails()
    registration = new ImportingRegistration()
    organization: Organization


    // todo: also add registration data (groups, cycle, registered at, paid...)
    // todo: also add possible existing member

    constructor(row: number, organization: Organization) {
        this.row = row
        this.organization = organization
    }

    static async importAll(sheet: XLSX.WorkSheet, columns: MatchedColumn[], organization: Organization): Promise<ImportResult> {
        if (!sheet['!ref']) {
            throw new Error("Missing ref in sheet")
        }

        const range = XLSX.utils.decode_range(sheet['!ref']); // get the range
        const result = new ImportResult()

        for(let row = range.s.r + 1; row <= range.e.r; row++){
            const member = new ImportingMember(row, organization)

            for (const column of columns) {
                if (!column.selected) {
                    continue
                }

                if (!column.matcher) {
                    throw new Error("Column doesnt have a matcher")
                }

                const valueCell = sheet[XLSX.utils.encode_cell({ r: row, c: column.index })] as XLSX.CellObject

                if (!valueCell) {
                    continue
                }

                // todo: add catch here

                try {
                    await column.matcher.apply(valueCell, member)
                } catch (e) {
                    if (isSimpleError(e) || isSimpleErrors(e)) {
                        result.errors.push(new ImportError(row, column.index, e.getHuman()))
                    } else {
                        result.errors.push(new ImportError(row, column.index, e.message))
                    }
                }
            }

            result.members.push(member)
        }

        return result
    }
}