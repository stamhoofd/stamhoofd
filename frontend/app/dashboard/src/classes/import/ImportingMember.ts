import { isSimpleError, isSimpleErrors } from "@simonbackx/simple-errors";
import { Group, MemberDetails, MemberWithRegistrations, Organization } from "@stamhoofd/structures";
import { Formatter,StringCompare } from "@stamhoofd/utility";
import XLSX from "xlsx";

import { MemberManager } from "../MemberManager";
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

    equal: MemberWithRegistrations | null = null
    probablyEqual: MemberWithRegistrations | null = null

    // todo: also add registration data (groups, cycle, registered at, paid...)
    // todo: also add possible existing member

    constructor(row: number, organization: Organization) {
        this.row = row
        this.organization = organization
    }


    isEqual(member: MemberWithRegistrations) {
        return StringCompare.typoCount(member.details!.firstName+" "+member.details!.lastName, this.details.firstName+" "+this.details.lastName) == 0 && StringCompare.typoCount(Formatter.dateNumber(member.details!.birthDay), Formatter.dateNumber(this.details.birthDay)) == 0 
    }

    isProbablyEqual(member: MemberWithRegistrations) {
        const t = StringCompare.typoCount(member.details!.firstName+" "+member.details!.lastName, this.details.firstName+" "+this.details.lastName)
        const y = StringCompare.typoCount(Formatter.dateNumber(member.details!.birthDay), Formatter.dateNumber(this.details.birthDay))

        if (t + y <= 3 && y <= 1 && t < 0.4*Math.min(this.details.firstName.length + this.details.lastName.length, member.details!.firstName.length+member.details!.lastName.length)) {
            return true;
        }
        return false;
    }

    static async importAll(sheet: XLSX.WorkSheet, columns: MatchedColumn[], organization: Organization): Promise<ImportResult> {
        if (!sheet['!ref']) {
            throw new Error("Missing ref in sheet")
        }

         // Start! :D
        const allMembers = await MemberManager.loadMembers(null, false)

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

            // Check if we find the same member
            if (member.details.firstName.length > 0 && member.details.lastName.length > 0) {
                for (const m of allMembers) {
                    if (member.isEqual(m)) {
                        member.equal = m
                        break
                    }
                }

                if (!member.equal) {
                    for (const m of allMembers) {
                        if (member.isProbablyEqual(m)) {
                            member.probablyEqual = m
                            break
                        }
                    }
                }
                
            }

            result.members.push(member)
        }

        return result
    }
}