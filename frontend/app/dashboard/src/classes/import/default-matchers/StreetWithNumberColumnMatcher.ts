import { SimpleError } from '@simonbackx/simple-errors';
import { Address } from '@stamhoofd/structures';
import XLSX from 'xlsx';
import { ColumnMatcher } from '../ColumnMatcher';
import { ColumnMatcherHelper } from '../ColumnMatcherHelper';
import { ImportMemberResult } from '../ImportMemberResult';
import { SharedMemberDetailsMatcher } from '../SharedMemberDetailsMatcher';

export class StreetWithNumberColumnMatcher extends SharedMemberDetailsMatcher implements ColumnMatcher {
    getName(): string {
        return 'Straat met huisnummer';
    }

    get id() {
        return this.getName() + '-' + this.category;
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        for (const word of this.negativeMatch) {
            if (cleaned.includes(word)) {
                return false;
            }
        }

        const possibleMatch = ['straat'];

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return this.doExamplesHaveNumbers(examples);
            }
        }
        return false;
    }

    doExamplesHaveNumbers(examples: string[]): boolean {
        if (examples.length === 0) {
            return false;
        }
        for (const example of examples) {
            if (!example.match(/^\s*([^0-9]+?)[\s,]*([0-9].*?)\s*$/g)) {
                return false;
            }
        }
        return true;
    }

    setValue(cell: XLSX.CellObject | undefined, importResult: ImportMemberResult) {
        if (!cell) {
            return;
        }

        // Check if string value
        const value = ((cell.w ?? cell.v) + '').trim();

        if (!value) {
            throw new SimpleError({
                code: 'invalid_type',
                message: $t(`aa752f68-29f0-4f3b-b73f-9a7b363b277b`),
            });
        }

        const { street, number } = Address.splitAddressLine(value);

        ColumnMatcherHelper.patchAddress(importResult, this.category, { street, number });
    }
}
