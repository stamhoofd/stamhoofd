import XLSX from 'xlsx';

import { ColumnMatcher } from '../ColumnMatcher';
import { ColumnMatcherHelper } from '../ColumnMatcherHelper';
import { ImportMemberResult } from '../ImportMemberResult';
import { SharedMemberDetailsMatcher } from '../SharedMemberDetailsMatcher';

export class CityColumnMatcher extends SharedMemberDetailsMatcher implements ColumnMatcher {
    private reg = /^\s*(([0-9]+?)(\s?[A-Z]{2})?)[\s,]+(([A-Za-z]|\s)+)\s*$/;
    private regReverse = /^\s*(([0-9]+?)(\s?[A-Z]{2})?)[\s,]+(([A-Za-z]|\s)+)\s*$/;

    getName(): string {
        return 'Gemeente';
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

        const possibleMatch = ['gemeente', 'stad', 'plaats'];

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return !this.doExamplesHaveZip(examples);
            }
        }
        return false;
    }

    doExamplesHaveZip(examples: string[]): boolean {
        if (examples.length === 0) {
            return false;
        }
        for (const example of examples) {
            if (!this.reg.exec(example) && !this.regReverse.exec(example)) {
                return false;
            }
        }
        return true;
    }

    setValue(cell: XLSX.CellObject | undefined, importResult: ImportMemberResult) {
        if (!cell) {
            return;
        }

        const city = ((cell.w ?? cell.v) + '').trim();

        if (!city) {
            return;
        }

        ColumnMatcherHelper.patchAddress(importResult, this.category, { city });
    }
}
