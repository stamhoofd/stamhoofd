import XLSX from 'xlsx';

import { SimpleError } from '@simonbackx/simple-errors';
import { BaseColumnMatcher } from '../ColumnMatcher';
import { ColumnMatcherHelper } from '../ColumnMatcherHelper';
import { ImportMemberResult } from '../ExistingMemberResult';
import { ImportMemberBase } from '../ImportMemberBase';
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
                message: 'Deze cel is leeg',
            });
        }

        const value = ((cell.w ?? cell.v) + '').trim();

        if (!value) {
            if (this.category === MemberDetailsMatcherCategory.Member) {
                throw new SimpleError({
                    code: 'invalid_type',
                    message: 'Deze cel is leeg',
                });
            }
        }

        return value;
    }

    setValue(cell: XLSX.CellObject | undefined, importResult: ImportMemberResult) {
        if (!cell && this.category !== MemberDetailsMatcherCategory.Member) {
            return;
        }

        const value = this.getValueFromCell(cell);
        if (!value) {
            return;
        }

        if (this.category === MemberDetailsMatcherCategory.Member) {
            importResult.addPatch({
                lastName: value,
            });
        }
        else if (this.category === MemberDetailsMatcherCategory.Parent1 || this.category === MemberDetailsMatcherCategory.Parent2) {
            ColumnMatcherHelper.patchParent(importResult, this.category, {
                lastName: value,
            });
        }
    }

    setBaseValue(cell: XLSX.CellObject | undefined, base: ImportMemberBase): void {
        if (this.category !== MemberDetailsMatcherCategory.Member) {
            return;
        }

        const value = this.getValueFromCell(cell);
        base.setLastName(value);
    }
}
