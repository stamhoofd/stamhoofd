import XLSX from 'xlsx';

import { SimpleError } from '@simonbackx/simple-errors';
import { DataValidator } from '@stamhoofd/utility';
import { ColumnMatcher } from '../ColumnMatcher';
import { ColumnMatcherHelper } from '../ColumnMatcherHelper';
import { ImportMemberResult } from '../ExistingMemberResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';
import { SharedMemberDetailsMatcher } from '../SharedMemberDetailsMatcher';

// should come after birthday
export class NationalRegisterNumberColumnMatcher extends SharedMemberDetailsMatcher implements ColumnMatcher {
    getName(): string {
        return $t('Rijksregisternummer');
    }

    get id() {
        return 'Rijksregisternummer' + '-' + this.category;
    }

    doesMatch(columnName: string, _examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        const possibleMatch = ['rijksregisternummer', 'insz', 'nationale nummer', 'nationaal nummer', 'rrn'].flatMap((word) => {
            switch (this.category) {
                case MemberDetailsMatcherCategory.Member as string:
                    return [word];
                case MemberDetailsMatcherCategory.Parent1 as string:
                    return [word + ' ouder', word + ' ouder1', word + ' ouder 1'];
                case MemberDetailsMatcherCategory.Parent2 as string:
                    return [word + ' ouder2', word + ' ouder 2'];
            }
            return [];
        });

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

        console.error('category: ' + this.category);

        if (!DataValidator.verifyBelgianNationalNumber(value)) {
            throw new SimpleError({
                code: 'invalid_field',
                message: $t('Ongeldig rijksregisternummer'),
            });
        }

        if (this.category === MemberDetailsMatcherCategory.Member as string) {
            const birthDay = importResult.patchedDetails.birthDay;

            if (birthDay && !DataValidator.doesMatchBelgianNationalNumber(value, birthDay)) {
                throw new SimpleError({
                    code: 'invalid_field',
                    message: $t(`b809571c-08ed-464c-9f40-3522f8dac440`),

                });
            }

            importResult.addPatch({
                nationalRegisterNumber: DataValidator.formatBelgianNationalNumber(value),
            });
        }
        else if (this.category === MemberDetailsMatcherCategory.Parent1 as string || this.category === MemberDetailsMatcherCategory.Parent2 as string) {
            ColumnMatcherHelper.patchParent(importResult, this.category as (MemberDetailsMatcherCategory.Parent1 | MemberDetailsMatcherCategory.Parent2), {
                nationalRegisterNumber: DataValidator.formatBelgianNationalNumber(value),
            });
        }
    }
}
