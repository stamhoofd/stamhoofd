import XLSX from 'xlsx';

import { ColumnMatcher } from '../ColumnMatcher';
import { ImportMemberResult } from '../ExistingMemberResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';

export class MemberNumberColumnMatcher implements ColumnMatcher {
    id = 'MemberNumberColumnMatcher';
    category: MemberDetailsMatcherCategory = MemberDetailsMatcherCategory.Member;

    getName(): string {
        return 'Lidnummer';
    }

    doesMatch(columnName: string, _examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        const possibleMatch = ['lidnummer', 'member number', 'identifier'];

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return true;
            }
        }

        if (cleaned === 'id') {
            // should be an exact match, since it is too short
            return true;
        }
        return false;
    }

    setValue(cell: XLSX.CellObject | undefined, importResult: ImportMemberResult) {
        if (!cell) {
            return;
        }

        const value = ((cell.w ?? cell.v) + '').trim();

        importResult.addPatch({
            memberNumber: value,
        });
    }
}
