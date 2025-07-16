import { SimpleError } from '@simonbackx/simple-errors';
import { Group } from '@stamhoofd/structures';
import { StringCompare } from '@stamhoofd/utility';
import XLSX from 'xlsx';
import { ColumnMatcher } from '../ColumnMatcher';
import { ImportMemberResult } from '../ImportMemberResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';

export class GroupColumnMatcher implements ColumnMatcher {
    id = 'GroupColumnMatcher';
    category: MemberDetailsMatcherCategory = MemberDetailsMatcherCategory.Member;

    constructor(private readonly getGroups: () => Group[]) {

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
                message: $t(`524de240-27b9-4fe3-9249-b2e49f1872bd`),
            });
        }

        // Check if string value
        if (cell.t !== 's' || typeof cell.v !== 'string' || !cell.v) {
            throw new SimpleError({
                code: 'invalid_type',
                message: $t(`060e319c-16cb-4ff6-aafe-e2beec83e2fc`),
            });
        }

        const value = cell.v;
        let minErrorGroup: Group | null = null;
        const minError = 0;

        for (const group of this.getGroups()) {
            const err = StringCompare.typoCount(group.settings.name.toString(), value);
            if (err < 2 && (minErrorGroup === null || err < minError)) {
                minErrorGroup = group;
            }
        }
        importResult.importRegistrationResult.group = minErrorGroup;

        if (!minErrorGroup) {
            throw new SimpleError({
                code: 'invalid_type',
                message: $t(`0ef6349f-0540-4c34-bc51-9919d38dc3ff`, { group: value }),
            });
        }
    }
}
