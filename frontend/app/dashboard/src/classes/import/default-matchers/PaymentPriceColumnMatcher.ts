import { SimpleError } from '@simonbackx/simple-errors';
import XLSX from 'xlsx';
import { ColumnMatcher } from '../ColumnMatcher';
import { ImportMemberResult } from '../ImportMemberResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';

export class PaymentPriceColumnMatcher implements ColumnMatcher {
    id = 'PaymentPriceColumnMatcher';
    category: MemberDetailsMatcherCategory = MemberDetailsMatcherCategory.Payment;

    getName(): string {
        return 'Bedrag (al dan niet betaald)';
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        const possibleMatch = ['lidgeld', 'price', 'prijs', 'bedrag'];

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
            throw new SimpleError({
                code: 'invalid_type',
                message: $t(`48f95d88-4cd4-414e-8236-e8ec8b921bfa`),
            });
        }

        // Check if string value

        const value = ((cell.w ?? cell.v) + '').toLowerCase().replace(/[€$\s,]+/g, '').trim().trim();
        const b = parseFloat(value);

        if (isNaN(b)) {
            throw new SimpleError({
                code: 'invalid_type',
                message: $t(`b9965b22-27c6-428d-a184-634da7345eae`, { value }),
            });
        }

        if (Math.floor(b * 100) !== b * 100) {
            throw new SimpleError({
                code: 'invalid_type',
                message: $t(`f78dea7f-d99d-4a0b-8557-0ff17d082dbb`, { value }),
            });
        }

        importResult.importRegistrationResult.price = Math.floor(b * 100);
    }
}
