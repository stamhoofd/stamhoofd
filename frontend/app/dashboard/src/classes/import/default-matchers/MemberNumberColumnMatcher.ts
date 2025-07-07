import XLSX from 'xlsx';

import { BaseColumnMatcher } from '../ColumnMatcher';
import { ImportMemberResult } from '../ExistingMemberResult';
import { ImportMemberBase } from '../ImportMemberBase';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';

export class MemberNumberColumnMatcher implements BaseColumnMatcher {
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

    private getValueFromCell(cell: XLSX.CellObject | undefined): string | null {
        if (!cell) {
            return null;
        }

        return ((cell.w ?? cell.v) + '').trim();
    }

    setValue(cell: XLSX.CellObject | undefined, importResult: ImportMemberResult) {
        const value = this.getValueFromCell(cell);
        if (!value) {
            return;
        }

        importResult.addPatch({
            memberNumber: value,
        });
    }

    setBaseValue(cell: XLSX.CellObject | undefined, base: ImportMemberBase): void {
        const value = this.getValueFromCell(cell);
        if (!value) {
            return;
        }
        base.setMemberNumber(value);
    }
}
