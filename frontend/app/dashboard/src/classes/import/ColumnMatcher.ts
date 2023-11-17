import XLSX from "xlsx";

import { ImportingMember } from "./ImportingMember";

export interface ColumnMatcher {
    id: string;
    category: string;

    getName(): string;
    doesMatch(columnName: string, examples: string[]): boolean;

    apply(cell: XLSX.CellObject | undefined, member: ImportingMember): Promise<void> | void;
}