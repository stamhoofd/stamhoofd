import { MemberDetails, Parent, ParentType } from '@stamhoofd/structures';
import XLSX from 'xlsx';

import { AutoEncoderPatchType, PartialWithoutMethods, PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ColumnMatcher } from '../ColumnMatcher';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';
import { SharedMemberDetailsMatcher } from '../SharedMemberDetailsMatcher';

export class LastNameColumnMatcher extends SharedMemberDetailsMatcher implements ColumnMatcher<MemberDetails> {
    getName(): string {
        return 'Achternaam';
    }

    get id() {
        return this.getName() + '-' + this.category;
    }

    doesMatch(columnName: string, _examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        for (const word of ['voornaam', 'firstname', ...this.negativeMatch]) {
            if (cleaned.includes(word)) {
                return false;
            }
        }

        const possibleMatch = ['naam', 'name', 'achternaam', 'lastname', 'familienaam'];

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return true;
            }
        }
        return false;
    }

    setValue(cell: XLSX.CellObject | undefined, accumulatedResult: PartialWithoutMethods<AutoEncoderPatchType<MemberDetails>>) {
        if (!cell && this.category === MemberDetailsMatcherCategory.Member) {
            throw new SimpleError({
                code: 'invalid_type',
                message: 'Deze cel is leeg',
            });
        }

        if (!cell) {
            return;
        }

        const value = ((cell.w ?? cell.v) + '').trim();

        if (!value) {
            if (this.category === MemberDetailsMatcherCategory.Member) {
                throw new SimpleError({
                    code: 'invalid_type',
                    message: 'Deze cel is leeg',
                });
            }
            // Not required field
            return;
        }

        if (this.category === MemberDetailsMatcherCategory.Member) {
            accumulatedResult.lastName = value;
        }
        else if (this.category === MemberDetailsMatcherCategory.Parent1) {
            if (accumulatedResult.parents === undefined) {
                accumulatedResult.parents = new PatchableArray();
            }
            if (accumulatedResult.parents.getPuts().length === 0) {
                // todo: test
                accumulatedResult.parents.addPut(Parent.create({
                    lastName: value,
                    type: ParentType.Parent1,
                }));
            }
        }
        else if (this.category === MemberDetailsMatcherCategory.Parent2) {
            if (accumulatedResult.parents === undefined) {
                accumulatedResult.parents = new PatchableArray();
            }

            while (accumulatedResult.parents!.getPuts().length < 2) {
                // todo: test
                accumulatedResult.parents.addPut(Parent.create({
                    lastName: value,
                    type: ParentType.Parent2,
                }));
            }
        }
    }
}
