import XLSX from 'xlsx';
import { BaseColumnMatcher } from '../ColumnMatcher';
import { ImportMemberBaseResult } from '../ImportMemberBaseResult';
import { ImportMemberResult } from '../ImportMemberResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';

export class MemberNumberColumnMatcher implements BaseColumnMatcher {
    id = 'MemberNumberColumnMatcher';
    category: MemberDetailsMatcherCategory = MemberDetailsMatcherCategory.Member;

    getName(): string {
        return 'Lidnummer';
    }

    doesMatch(columnName: string, _examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        if (cleaned === 'id') {
            // id is not the same as member number!
            // should be an exact match, since it is too short
            return false;
        }

        const possibleMatch = ['lidnummer', 'member number', 'membernumber'];

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return true;
            }
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

    setBaseValue(cell: XLSX.CellObject | undefined, base: ImportMemberBaseResult): void {
        const value = this.getValueFromCell(cell);
        if (!value) {
            return;
        }
        base.setMemberNumber(value);
    }
}
