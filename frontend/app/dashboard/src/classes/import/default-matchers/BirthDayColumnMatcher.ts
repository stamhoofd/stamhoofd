import { CellObject } from 'xlsx';
import { BaseColumnMatcher } from '../ColumnMatcher';
import { DateColumnMatcher } from '../DateColumnMatcher';
import { ImportMemberBaseResult } from '../ImportMemberBaseResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';

export class BirthDayColumnMatcher extends DateColumnMatcher implements BaseColumnMatcher {
    constructor() {
        super({
            name: $t(`00650ac3-eb78-4c8b-b7ec-d892772837a1`),
            category: MemberDetailsMatcherCategory.Member,
            required: false,
            possibleMatch: ['geboortedatum', 'verjaardag', 'birth day'],
            get: importResult => importResult.patchedDetails.birthDay ?? undefined,
            save: (d, importResult) => {
                importResult.addPatch({
                    birthDay: d,
                });
            },
        });
    }

    setBaseValue(cell: CellObject | undefined, base: ImportMemberBaseResult): void {
        const value = this.getValue(cell, undefined);
        if (value !== undefined) {
            base.setBirthDay(value);
        }
    }
}
