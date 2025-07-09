import { SimpleError } from '@simonbackx/simple-errors';
import XLSX from 'xlsx';
import { BaseColumnMatcher } from '../ColumnMatcher';
import { ColumnMatcherHelper } from '../ColumnMatcherHelper';
import { ImportMemberBaseResult } from '../ImportMemberBaseResult';
import { ImportMemberResult } from '../ImportMemberResult';
import { MemberDetailsMatcherCategory } from '../MemberDetailsMatcherCategory';
import { SharedMemberDetailsMatcher } from '../SharedMemberDetailsMatcher';

export class LastNameColumnMatcher extends SharedMemberDetailsMatcher implements BaseColumnMatcher {
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

    private getValueFromCell(cell: XLSX.CellObject | undefined): string {
        if (!cell) {
            throw new SimpleError({
                code: 'invalid_type',
                message: $t(`Deze cel is leeg`),
            });
        }

        const value = ((cell.w ?? cell.v) + '').trim();

        if (!value) {
            if (this.category === MemberDetailsMatcherCategory.Member as string) {
                throw new SimpleError({
                    code: 'invalid_type',
                    message: $t(`Deze cel is leeg`),
                });
            }
        }

        return value;
    }

    setValue(cell: XLSX.CellObject | undefined, importResult: ImportMemberResult) {
        if (!cell && this.category !== MemberDetailsMatcherCategory.Member as string) {
            return;
        }

        const value = this.getValueFromCell(cell);
        if (!value) {
            return;
        }

        if (this.category === MemberDetailsMatcherCategory.Member as string) {
            importResult.addPatch({
                lastName: value,
            });
        }
        else if (this.category === MemberDetailsMatcherCategory.Parent1 as string || this.category === MemberDetailsMatcherCategory.Parent2 as string) {
            ColumnMatcherHelper.patchParent(importResult, this.category as (MemberDetailsMatcherCategory.Parent1 | MemberDetailsMatcherCategory.Parent2), {
                lastName: value,
            });
        }
    }

    setBaseValue(cell: XLSX.CellObject | undefined, base: ImportMemberBaseResult): void {
        if (this.category !== MemberDetailsMatcherCategory.Member as string) {
            return;
        }

        const value = this.getValueFromCell(cell);
        base.setLastName(value);
    }
}
