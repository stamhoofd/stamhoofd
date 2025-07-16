import { SimpleError } from '@simonbackx/simple-errors';
import { Gender } from '@stamhoofd/structures';
import XLSX from 'xlsx';
import { ColumnMatcher } from '../ColumnMatcher';
import { ImportMemberResult } from '../ImportMemberResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';

export class GenderColumnMatcher implements ColumnMatcher {
    id = 'GenderColumnMatcher';
    category: MemberDetailsMatcherCategory = MemberDetailsMatcherCategory.Member;

    getName(): string {
        return 'Geslacht';
    }

    doesMatch(columnName: string, _examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        const possibleMatch = ['geslacht', 'gender', 'sex'];

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
                message: $t(`48f95d88-4cd4-414e-8236-e8ec8b921bfa`),
            });
        }

        // Check if string value
        const value = ((cell.w ?? cell.v) + '').toLowerCase().trim();
        let gender = Gender.Other;

        if (value.includes('jongen') || value.includes('boy') || (value.startsWith('m') && !value.includes('meisje'))) {
            gender = Gender.Male;
        }
        else if (value.startsWith('v') || value.startsWith('f') || value.includes('meisje') || value.includes('girl')) {
            gender = Gender.Female;
        }
        else if (value === 'x') {
            gender = Gender.Other;
        }
        else if (value !== '') {
            throw new SimpleError({
                code: 'invalid_type',
                message: $t(`2d500310-cfb7-4286-85b8-9704eea1b5c5`, { gender: value }),
            });
        }

        importResult.addPatch({
            gender,
        });
    }
}
