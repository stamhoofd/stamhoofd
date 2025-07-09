import { SimpleError } from '@simonbackx/simple-errors';
import XLSX from 'xlsx';

import { ColumnMatcher } from './import/ColumnMatcher';
import { ImportMemberResult } from './import/FindExistingMemberResult';
import { SharedMemberDetailsMatcher } from './import/SharedMemberDetailsMatcher';

export abstract class GeneralMemberDetailsMatcher<T> extends SharedMemberDetailsMatcher implements ColumnMatcher {
    name: string;
    required = false;

    get?: (importResult: ImportMemberResult) => T | undefined;
    save: (value: T, importResult: ImportMemberResult) => void;

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
        category: string;
        required?: boolean;
        possibleMatch?: string[];
        negativeMatch?: string[];
        save: (value: T, importResult: ImportMemberResult) => void;
        get?: (importResult: ImportMemberResult) => T | undefined;
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

    getValue(cell: XLSX.CellObject | undefined, importResult: ImportMemberResult | undefined): NonNullable<T> | undefined {
        if (!cell && this.required) {
            throw new SimpleError({
                code: 'invalid_type',
                message: $t(`Deze cel is leeg`),
            });
        }

        if (!cell) {
            return;
        }

        const value = importResult ? this.parseObject(cell, this.get ? this.get(importResult) : undefined) : this.parseObject(cell, undefined);

        if (!value) {
            if (this.required) {
                throw new SimpleError({
                    code: 'invalid_type',
                    message: $t(`Deze cel is leeg`),
                });
            }
            return;
        }

        return value;
    }

    setValue(cell: XLSX.CellObject | undefined, importResult: ImportMemberResult) {
        const value = this.getValue(cell, importResult);
        if (value !== undefined) {
            this.save(value, importResult);
        }
    }
}
