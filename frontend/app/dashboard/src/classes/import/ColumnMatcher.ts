import XLSX from "xlsx";

import { ImportingMember } from "./ImportingMember";
import { PlatformMember } from "@stamhoofd/structures";

export interface ColumnMatcher {
    id: string;
    category: string;

    getName(): string;
    doesMatch(columnName: string, examples: string[]): boolean;

    apply(cell: XLSX.CellObject | undefined, member: ImportingMember): Promise<void> | void;

    //todo
    createPatch(member: ImportingMember, existingMember: PlatformMember): void;
}
