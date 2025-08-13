import XLSX from 'xlsx';
import { ColumnMatcher } from '../ColumnMatcher';
import { ImportMemberResult } from '../ImportMemberResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';

export class SecurityCodeColumnMatcher implements ColumnMatcher {
    readonly category = MemberDetailsMatcherCategory.Member as string;
    readonly id = 'security-code';

    getName(): string {
        return $t('34a37057-5c76-43ea-bc79-e67b8b09a4ee');
    }

    doesMatch(columnName: string, _examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        const possibleMatch = ['code'];

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
            return;
        }

        const value = ((cell.w ?? cell.v) + '').trim();

        if (!value) {
            return;
        }

        importResult.addPatch({
            securityCode: value,
        });
    }
}
