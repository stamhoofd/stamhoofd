import type XLSX from 'xlsx';
import type { BaseColumnMatcher } from '../ColumnMatcher';
import type { ImportMemberBaseResult } from '../ImportMemberBaseResult';
import type { ImportMemberResult } from '../ImportMemberResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';

/**
 * Matches the internal id of a member in the system. Rows with an id are only matched
 * on that id and can never create a new member.
 */
export class MemberIdColumnMatcher implements BaseColumnMatcher {
    id = 'MemberIdColumnMatcher';
    category: MemberDetailsMatcherCategory = MemberDetailsMatcherCategory.Member;

    getName(): string {
        return 'ID';
    }

    doesMatch(columnName: string, _examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        // should be an exact match, since 'id' is too short to match on 'includes'
        return cleaned === 'id' || cleaned === 'lid id' || cleaned === 'member id' || cleaned === 'stamhoofd id';
    }

    setValue(_cell: XLSX.CellObject | undefined, _importResult: ImportMemberResult): void {
        // The id is only used to find the existing member, which happens via setBaseValue
    }

    setBaseValue(cell: XLSX.CellObject | undefined, base: ImportMemberBaseResult): void {
        if (!cell) {
            return;
        }

        const value = ((cell.w ?? cell.v) + '').trim();
        if (!value) {
            return;
        }
        base.setId(value);
    }
}
