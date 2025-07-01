import XLSX from 'xlsx';
import { ImportMemberResult } from './ExistingMemberResult';
import { ImportMemberBase } from './ImportMemberBase';

export interface ColumnMatcher {
    id: string;
    category: string;

    getName(): string;
    doesMatch(columnName: string, examples: string[]): boolean;

    setValue(cell: XLSX.CellObject | undefined, importResult: ImportMemberResult): Promise<void> | void;
}

export interface BaseColumnMatcher extends ColumnMatcher {
    setBaseValue(cell: XLSX.CellObject | undefined, base: ImportMemberBase): void;
}
