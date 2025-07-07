import { SimpleError } from '@simonbackx/simple-errors';
import XLSX from 'xlsx';

import { BaseColumnMatcher } from '../ColumnMatcher';
import { ColumnMatcherHelper } from '../ColumnMatcherHelper';
import { ImportMemberResult } from '../ExistingMemberResult';
import { ImportMemberBase } from '../ImportMemberBase';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';
import { SharedMemberDetailsMatcher } from '../SharedMemberDetailsMatcher';

export class FullNameColumnMatcher extends SharedMemberDetailsMatcher implements BaseColumnMatcher {
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

    private getValueFromCell(cell: XLSX.CellObject | undefined): string {
        if (!cell) {
            throw new SimpleError({
                code: 'invalid_type',
                message: 'Deze cel is leeg',
            });
        }

        const value = ((cell.w ?? cell.v) + '').trim();

        if (!value) {
            if (this.category === MemberDetailsMatcherCategory.Member as string) {
                throw new SimpleError({
                    code: 'invalid_type',
                    message: 'Deze cel is leeg',
                });
            }
        }

        return value;
    }

    private getFirstNameAndLastName(value: string) {
        // TODO: improve splitting
        const firstName = value.split(' ')[0].trim();
        const lastName = value.substr(firstName.length + 1).trim();

        return {
            firstName,
            lastName,
        };
    }

    setValue(cell: XLSX.CellObject | undefined, importResult: ImportMemberResult) {
        if (!cell && this.category !== MemberDetailsMatcherCategory.Member as string) {
            return;
        }

        const value = this.getValueFromCell(cell);
        if (!value) {
            return;
        }

        const { firstName, lastName } = this.getFirstNameAndLastName(value);

        if (this.category === MemberDetailsMatcherCategory.Member as string) {
            importResult.addPatch({
                firstName,
                lastName,
            });
        }
        else if (this.category === MemberDetailsMatcherCategory.Parent1 as string || this.category === MemberDetailsMatcherCategory.Parent2 as string) {
            ColumnMatcherHelper.patchParent(importResult, this.category as (MemberDetailsMatcherCategory.Parent1 | MemberDetailsMatcherCategory.Parent2), {
                firstName,
                lastName,
            });
        }
    }

    setBaseValue(cell: XLSX.CellObject | undefined, base: ImportMemberBase): void {
        if (this.category !== MemberDetailsMatcherCategory.Member as string) {
            return;
        }

        const value = this.getValueFromCell(cell);
        const { firstName, lastName } = this.getFirstNameAndLastName(value);
        base.setFirstName(firstName);
        base.setLastName(lastName);
    }
}
