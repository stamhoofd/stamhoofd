import { SimpleError } from '@simonbackx/simple-errors';
import { DataValidator } from '@stamhoofd/utility';
import XLSX from 'xlsx';
import { ColumnMatcher } from '../ColumnMatcher';
import { ColumnMatcherHelper } from '../ColumnMatcherHelper';
import { ImportMemberResult } from '../ExistingMemberResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';
import { SharedMemberDetailsMatcher } from '../SharedMemberDetailsMatcher';

export class EmailColumnMatcher extends SharedMemberDetailsMatcher implements ColumnMatcher {
    getName(): string {
        return 'E-mailadres';
    }

    get id() {
        return this.getName() + '-' + this.category;
    }

    doesMatch(columnName: string, _examples: string[]): boolean {
        const cleaned = columnName.trim().toLowerCase();

        for (const word of this.negativeMatch) {
            if (cleaned.includes(word)) {
                return false;
            }
        }

        const possibleMatch = [this.category === MemberDetailsMatcherCategory.Member as string ? 'mail lid' : 'mail'];

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

        // Check if string value
        const value = ((cell.w ?? cell.v) + '').trim();

        if (!value) {
            // Not required field
            return;
        }

        const email = value.toLowerCase();
        if (!DataValidator.isEmailValid(email)) {
            throw new SimpleError({
                code: 'invalid_field',
                message: 'Ongeldig e-mailadres',
            });
        }

        if (this.category === MemberDetailsMatcherCategory.Member as string) {
            importResult.addPatch({
                email,
            });
        }
        else if (this.category === MemberDetailsMatcherCategory.Parent1 as string || this.category === MemberDetailsMatcherCategory.Parent2 as string) {
            ColumnMatcherHelper.patchParent(importResult, this.category as (MemberDetailsMatcherCategory.Parent1 | MemberDetailsMatcherCategory.Parent2), {
                email,
            });
        }
    }
}
