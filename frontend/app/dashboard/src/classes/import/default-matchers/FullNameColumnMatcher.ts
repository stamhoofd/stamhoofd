import { SimpleError } from '@simonbackx/simple-errors';
import { Parent, ParentType } from '@stamhoofd/structures';
import XLSX from 'xlsx';

import { PatchableArray } from '@simonbackx/simple-encoding';
import { ColumnMatcher } from '../ColumnMatcher';
import { ImportMemberAccumulatedResult } from '../ImportMemberAccumulatedResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';
import { SharedMemberDetailsMatcher } from '../SharedMemberDetailsMatcher';

export class FullNameColumnMatcher extends SharedMemberDetailsMatcher implements ColumnMatcher<ImportMemberAccumulatedResult> {
    getName(): string {
        return 'Volledige naam';
    }

    get id() {
        return this.getName() + '-' + this.category;
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        for (const word of ['voornaam', 'first', 'achter', 'last', ...this.negativeMatch]) {
            if (cleaned.includes(word)) {
                return false;
            }
        }

        if (['volledige naam'].includes(cleaned)) {
            return true;
        }

        const possibleMatch = ['naam', 'name'];

        for (const word of possibleMatch) {
            if (cleaned.includes(word)) {
                // check if the full name was really used, and not only the first or last name
                return this.doExamplesHaveFullNames(examples);
            }
        }
        return false;
    }

    doExamplesHaveFullNames(examples: string[]): boolean {
        if (examples.length === 0) {
            return false;
        }
        for (const example of examples) {
            if (!example.match(/\w\s+\w/g)) {
                return false;
            }
        }
        return true;
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

        const v = ((cell.w ?? cell.v) + '').trim();

        if (!v) {
            if (this.category === MemberDetailsMatcherCategory.Member) {
                throw new SimpleError({
                    code: 'invalid_type',
                    message: 'Deze cel is leeg',
                });
            }
            // Not required field
            return;
        }

        // TODO: improve splitting
        let firstName = v.split(' ')[0];
        let lastName = v.substr(firstName.length + 1);

        firstName = firstName.trim();
        lastName = lastName.trim();

        if (this.category === MemberDetailsMatcherCategory.Member) {
            data.firstName = firstName;
            data.lastName = lastName;
        }
        else if (this.category === MemberDetailsMatcherCategory.Parent1) {
            if (data.parents === undefined) {
                data.parents = new PatchableArray();
            }
            if (data.parents.getPuts().length === 0) {
                // todo: test
                data.parents.addPut(Parent.create({
                    firstName,
                    lastName,
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
                    firstName,
                    lastName,
                    type: ParentType.Parent2,
                }));
            }
        }
    }
}
