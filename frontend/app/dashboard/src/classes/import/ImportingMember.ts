import { Group, MemberDetails, Organization } from "@stamhoofd/structures";
import XLSX from "xlsx";

import { MatchedColumn } from "./MatchedColumn";

export class ImportingRegistration {
    group: Group | null = null
    paid = true
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

    static importAll(sheet: XLSX.WorkSheet, columns: MatchedColumn[], organization: Organization) {
        if (!sheet['!ref']) {
            throw new Error("Missing ref in sheet")
        }

        const range = XLSX.utils.decode_range(sheet['!ref']); // get the range
        const members: ImportingMember[] = []

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

                column.matcher.apply(valueCell, member)
            }

            members.push(member)
        }

        return members
    }
}