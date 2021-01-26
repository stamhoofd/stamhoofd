import XLSX from "xlsx";

import { ImportingMember } from "./ImportingMember";
import { MatcherCategory } from "./MatcherCategory";

export interface ColumnMatcher {
    id: string;
    category: MatcherCategory;

    getName(): string;
    doesMatch(columnName: string, examples: string[]): boolean;

    apply(cell: XLSX.CellObject | undefined, member: ImportingMember): Promise<void> | void;
}