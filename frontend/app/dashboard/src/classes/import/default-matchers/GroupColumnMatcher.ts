import { SimpleError } from '@simonbackx/simple-errors';
import { Group } from '@stamhoofd/structures';
import { StringCompare } from '@stamhoofd/utility';
import XLSX from 'xlsx';

import { ColumnMatcher } from '../ColumnMatcher';
import { ImportMemberResult } from '../ExistingMemberResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';

export class GroupColumnMatcher implements ColumnMatcher {
    id = 'GroupColumnMatcher';
    category: MemberDetailsMatcherCategory = MemberDetailsMatcherCategory.Member;

    constructor(private readonly groups: Group[]) {

    }

    getName(): string {
        return 'Inschrijvingsgroep';
    }

    doesMatch(columnName: string, _examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        const possibleMatch = ['groep', 'tak', 'indeling', 'categorie', 'ploeg'];

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return true;
            }
        }
        return false;
    }

    setValue(cell: XLSX.CellObject | undefined, importResult: ImportMemberResult) {
        if (!cell) {
            throw new SimpleError({
                code: 'invalid_type',
                message: 'Deze inschrijvingsgroep is leeg',
            });
        }

        // Check if string value
        if (cell.t !== 's' || typeof cell.v !== 'string' || !cell.v) {
            throw new SimpleError({
                code: 'invalid_type',
                message: 'De inschrijvingsgroep is leeg',
            });
        }

        const value = cell.v;
        let minErrorGroup: Group | null = null;
        const minError = 0;

        for (const group of this.groups) {
            const err = StringCompare.typoCount(group.settings.name.toString(), value);
            if (err < 2 && (minErrorGroup === null || err < minError)) {
                minErrorGroup = group;
            }
        }
        importResult.registration.group = minErrorGroup;

        if (!minErrorGroup) {
            throw new SimpleError({
                code: 'invalid_type',
                message: "'" + value + "' is geen geldige inschrijvingsgroep (deze bestaat niet in Stamhoofd). Zorg dat deze overeenkomt met de namen in Stamhoofd.",
            });
        }
    }
}
