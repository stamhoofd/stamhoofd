import { SimpleError } from '@simonbackx/simple-errors';
import XLSX from 'xlsx';

import { AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import { MemberDetails } from '@stamhoofd/structures';
import { ColumnMatcher } from './import/ColumnMatcher';
import { MemberDetailsMatcherCategory } from './import/MemberDetailsMatcherCategory';
import { SharedMemberDetailsMatcher } from './import/SharedMemberDetailsMatcher';

export abstract class GeneralMemberDetailsMatcher<T> extends SharedMemberDetailsMatcher implements ColumnMatcher<MemberDetails> {
    name: string;
    required = false;

    get?: (accumulatedResult: PartialWithoutMethods<AutoEncoderPatchType<MemberDetails>>) => T | undefined;
    save: (value: T, accumulatedResult: PartialWithoutMethods<AutoEncoderPatchType<MemberDetails>>) => void;

    abstract parse(v: string, current: T | undefined): T;

    // Override if you want more custom
    parseObject(cell: XLSX.CellObject, current: T | undefined): T | undefined {
        const v = ((cell.w ?? cell.v) + '').trim();

        if (!v) {
            return;
        }

        return this.parse(v, current);
    }

    constructor({ name, category, required, possibleMatch, negativeMatch, save, get }: {
        name: string;
        category: MemberDetailsMatcherCategory;
        required?: boolean;
        possibleMatch?: string[];
        negativeMatch?: string[];
        save: (value: T, accumulatedResult: PartialWithoutMethods<AutoEncoderPatchType<MemberDetails>>) => void;
        get?: (accumulatedResult: PartialWithoutMethods<AutoEncoderPatchType<MemberDetails>>) => T | undefined;
    }) {
        super(category);
        this.name = name;
        this.required = required ?? false;
        this.possibleMatch = possibleMatch ?? [];
        this.negativeMatch = negativeMatch ?? [];
        this.save = save;
        this.get = get;
    }

    getName(): string {
        return this.name;
    }

    get id() {
        return this.getName() + '-' + this.category;
    }

    doesMatch(columnName: string, examples: string[]): boolean {
        if (super.doesMatch(columnName, examples)) {
            return true;
        }

        const nameCleaned = this.name.trim().toLowerCase();
        const nameCleanedWithoutBrackets = nameCleaned.replace(/\(.*\)/g, '').trim();

        if (columnName.trim().toLowerCase().includes(nameCleanedWithoutBrackets)) {
            return true;
        }

        return false;
    }

    setValue(cell: XLSX.CellObject | undefined, accumulatedResult: PartialWithoutMethods<AutoEncoderPatchType<MemberDetails>>) {
        if (!cell && this.required) {
            throw new SimpleError({
                code: 'invalid_type',
                message: 'Deze cel is leeg',
            });
        }

        if (!cell) {
            return;
        }

        const value = this.parseObject(cell, this.get ? this.get(accumulatedResult) : undefined);
        if (!value) {
            if (this.required) {
                throw new SimpleError({
                    code: 'invalid_type',
                    message: 'Deze cel is leeg',
                });
            }
            return;
        }
        this.save(value, accumulatedResult);
    }
}
