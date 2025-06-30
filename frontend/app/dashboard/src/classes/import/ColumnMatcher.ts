import XLSX from 'xlsx';

export interface ColumnMatcher<T> {
    id: string;
    category: string;

    getName(): string;
    doesMatch(columnName: string, examples: string[]): boolean;

    setValue(cell: XLSX.CellObject | undefined, accumulatedResult: T): void;
}
