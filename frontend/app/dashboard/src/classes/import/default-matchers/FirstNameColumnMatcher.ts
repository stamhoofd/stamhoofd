import { Parent, ParentType } from '@stamhoofd/structures';
import XLSX from 'xlsx';

import { PatchableArray } from '@simonbackx/simple-encoding';
import { SimpleError } from '@simonbackx/simple-errors';
import { ColumnMatcher } from '../ColumnMatcher';
import { ImportMemberAccumulatedResult } from '../ImportMemberAccumulatedResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';
import { SharedMemberDetailsMatcher } from '../SharedMemberDetailsMatcher';

export class FirstNameColumnMatcher extends SharedMemberDetailsMatcher implements ColumnMatcher<ImportMemberAccumulatedResult> {
    getName(): string {
        return 'Voornaam';
    }

    get id() {
        return this.getName() + '-' + this.category;
    }

    doesMatch(columnName: string, _examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        for (const word of ['achternaam', 'familienaam', 'lastname', ...this.negativeMatch]) {
            if (cleaned.includes(word)) {
                return false;
            }
        }

        const possibleMatch = ['voornaam', 'firstname'];

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return true;
            }
        }
        return false;
    }

    setValue(cell: XLSX.CellObject | undefined, { data }: ImportMemberAccumulatedResult) {
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
            data.firstName = value;
        }
        else if (this.category === MemberDetailsMatcherCategory.Parent1) {
            if (data.parents === undefined) {
                data.parents = new PatchableArray();
            }
            if (data.parents.getPuts().length === 0) {
                // todo: test
                data.parents.addPut(Parent.create({
                    firstName: value,
                    type: ParentType.Parent1,
                }));
            }
        }
        else if (this.category === MemberDetailsMatcherCategory.Parent2) {
            if (data.parents === undefined) {
                data.parents = new PatchableArray();
            }

            while (data.parents!.getPuts().length < 2) {
                // todo: test
                data.parents.addPut(Parent.create({
                    firstName: value,
                    type: ParentType.Parent2,
                }));
            }
        }
    }
}
