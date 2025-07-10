import XLSX from 'xlsx';
import { ImportMemberBaseResult } from './ImportMemberBaseResult';
import { ImportMemberResult } from './ImportMemberResult';

export interface ColumnMatcher {
    id: string;
    category: string;

    getName(): string;
    doesMatch(columnName: string, examples: string[]): boolean;

    setValue(cell: XLSX.CellObject | undefined, importResult: ImportMemberResult): Promise<void> | void;
}

export interface BaseColumnMatcher extends ColumnMatcher {
    setBaseValue(cell: XLSX.CellObject | undefined, base: ImportMemberBaseResult): void;
}
