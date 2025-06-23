import { AutoEncoder, AutoEncoderPatchType, PartialWithoutMethods } from '@simonbackx/simple-encoding';
import XLSX from 'xlsx';

export interface ColumnMatcher<T extends AutoEncoder> {
    id: string;
    category: string;

    getName(): string;
    doesMatch(columnName: string, examples: string[]): boolean;

    getPatchValue(cell: XLSX.CellObject | undefined, accumulatedResult: PartialWithoutMethods<AutoEncoderPatchType<T>>): PartialWithoutMethods<AutoEncoderPatchType<T>>;
}
