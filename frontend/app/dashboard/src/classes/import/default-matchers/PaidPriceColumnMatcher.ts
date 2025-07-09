import { SimpleError } from '@simonbackx/simple-errors';
import XLSX from 'xlsx';
import { ColumnMatcher } from '../ColumnMatcher';
import { ImportMemberResult } from '../ImportMemberResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';

export class PaidPriceColumnMatcher implements ColumnMatcher {
    id = 'PaidPriceColumnMatcher';
    category: MemberDetailsMatcherCategory = MemberDetailsMatcherCategory.Payment;

    getName(): string {
        return 'Bedrag dat betaald werd';
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        const possibleMatch = ['betaald'];

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return this.areNumbersValues(examples);
            }
        }
        return false;
    }

    areNumbersValues(examples: string[]) {
        for (const example of examples) {
            if (isNaN(parseFloat(example.toLowerCase().replace(/[€$\s,]+/g, '').trim()))) {
                return false;
            }
        }
        return true;
    }

    setValue(cell: XLSX.CellObject | undefined, importResult: ImportMemberResult) {
        if (!cell) {
            importResult.importRegistrationResult.paidPrice = 0;
            return;
        }

        const value = ((cell.w ?? cell.v) + '').toLowerCase().replace(/[€$\s,]+/g, '').trim();
        const b = parseFloat(value);

        if (isNaN(b)) {
            throw new SimpleError({
                code: 'invalid_type',
                message: "'" + value + "' is geen geldig bedrag",
            });
        }

        importResult.importRegistrationResult.paidPrice = Math.floor(b * 100);
    }
}
