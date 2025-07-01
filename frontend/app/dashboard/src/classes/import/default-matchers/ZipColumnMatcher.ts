import { SimpleError } from '@simonbackx/simple-errors';
import XLSX from 'xlsx';

import { ColumnMatcher } from '../ColumnMatcher';
import { ColumnMatcherHelper } from '../ColumnMatcherHelper';
import { ImportMemberResult } from '../ExistingMemberResult';
import { SharedMemberDetailsMatcher } from '../SharedMemberDetailsMatcher';

export class ZipColumnMatcher extends SharedMemberDetailsMatcher implements ColumnMatcher {
    getName(): string {
        return 'Postcode';
    }

    get id() {
        return this.getName() + '-' + this.category;
    }

    doesMatch(columnName: string, _examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        for (const word of this.negativeMatch) {
            if (cleaned.includes(word)) {
                return false;
            }
        }

        const possibleMatch = ['postcode', 'zip', 'postal'];

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

        // Check if string value

        const postalCode = ((cell.w ?? cell.v) + '').trim();

        if (postalCode.length === 0) {
            throw new SimpleError({
                code: 'invalid_type',
                message: 'Geen tekst in deze cel',
            });
        }

        ColumnMatcherHelper.patchAddress(importResult, this.category, { postalCode });
    }
}
