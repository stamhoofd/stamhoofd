import XLSX from 'xlsx';
import { ColumnMatcher } from '../ColumnMatcher';
import { ColumnMatcherHelper } from '../ColumnMatcherHelper';
import { ImportMemberResult } from '../ImportMemberResult';
import { SharedMemberDetailsMatcher } from '../SharedMemberDetailsMatcher';

export class StreetNumberColumnMatcher extends SharedMemberDetailsMatcher implements ColumnMatcher {
    getName(): string {
        return 'Huisnummer';
    }

    get id() {
        return this.getName() + '-' + this.category;
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        for (const word of [...this.negativeMatch, 'telefoon', 'gsm', 'phone', 'tel', 'lidnummer', 'rijksregister', 'bestel', 'uitpas']) {
            if (cleaned.includes(word)) {
                return false;
            }
        }

        const possibleMatch = ['huisnummer', 'street number', 'huis', 'nummer'];

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                return !this.doExamplesHaveNumbers(examples);
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

        const number = ((cell.w ?? cell.v) + '').trim();

        if (number.length === 0) {
            return;
        }

        ColumnMatcherHelper.patchAddress(importResult, this.category, { number });
    }
}
