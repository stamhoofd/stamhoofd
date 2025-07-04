import XLSX from 'xlsx';

import { SimpleError } from '@simonbackx/simple-errors';
import { DataValidator } from '@stamhoofd/utility';
import { ColumnMatcher } from '../ColumnMatcher';
import { ImportMemberResult } from '../ExistingMemberResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';

export class UitpasNumberColumnMatcher implements ColumnMatcher {
    readonly category = MemberDetailsMatcherCategory.Member as string;
    readonly id = 'UiTPAS-nummer';

    getName(): string {
        return $t('UiTPAS-nummer');
    }

    doesMatch(columnName: string, _examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        const possibleMatch = ['uitpas'];

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

        if (!DataValidator.isUitpasNumberValid(value)) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t('Dit is geen geldig UiTPAS-nummer'),
            });
        }

        importResult.addPatch({
            uitpasNumber: value,
        });
    }
}
