import { SimpleError } from '@simonbackx/simple-errors';
import XLSX from 'xlsx';

import { ColumnMatcher } from '../ColumnMatcher';
import { ColumnMatcherHelper } from '../ColumnMatcherHelper';
import { ImportMemberResult } from '../ImportMemberResult';
import { SharedMemberDetailsMatcher } from '../SharedMemberDetailsMatcher';

export class CityWithZipColumnMatcher extends SharedMemberDetailsMatcher implements ColumnMatcher {
    private reg = /^\s*(([0-9]+?)(\s?[A-Z]{2})?)[\s,]+(([A-Za-z]|\s)+)\s*$/;
    private regReverse = /^\s*(([0-9]+?)(\s?[A-Z]{2})?)[\s,]+(([A-Za-z]|\s)+)\s*$/;

    getName(): string {
        return 'Gemeente met postcode';
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

        const possibleMatch = ['gemeente'];

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return this.doExamplesHaveZip(examples);
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

        const value = ((cell.w ?? cell.v) + '').trim();

        if (!value) {
            return;
        }

        let match = this.reg.exec(value);
        let city = '';
        let postalCode = '';
        if (!match) {
            match = this.regReverse.exec(value);
            if (!match) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: 'City and zipcode expected',
                    human: $t(`We verwachten zowel een postcode als een gemeente`),
                });
            }
            // TODO! order!
            city = match[1];
            postalCode = match[4];
        }
        else {
            postalCode = match[1];
            city = match[4];
        }

        ColumnMatcherHelper.patchAddress(importResult, this.category, {
            postalCode,
            city,
        });
    }
}
