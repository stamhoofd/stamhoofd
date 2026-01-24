import { SimpleError } from '@simonbackx/simple-errors';
import { UitpasNumberDetails } from '@stamhoofd/structures';
import { DataValidator } from '@stamhoofd/utility';
import XLSX from 'xlsx';
import { ColumnMatcher } from '../ColumnMatcher';
import { ImportMemberResult } from '../ImportMemberResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';

export class UitpasNumberColumnMatcher implements ColumnMatcher {
    readonly category = MemberDetailsMatcherCategory.Member as string;
    readonly id = 'UiTPAS-nummer';

    getName(): string {
        return $t('e330f60b-d331-49a2-a437-cddc31a878de');
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
                message: $t('a717759d-4b62-40b2-bf8a-55e42565030b'),
            });
        }

        importResult.addPatch({
            uitpasNumberDetails: UitpasNumberDetails.patch({
                uitpasNumber: value,
            }),
        });
    }
}
