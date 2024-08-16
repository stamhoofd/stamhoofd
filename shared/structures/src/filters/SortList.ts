import { Data } from "@simonbackx/simple-encoding";
import { SimpleError } from "@simonbackx/simple-errors";

export enum SortItemDirection {
    ASC = "ASC",
    DESC = "DESC"
}
export type SortItem = { key: string; order: SortItemDirection; }
export type SortList = SortItem[]

export type AssertSortItem = { key: string; order?: SortItemDirection; }
export type AssertSortList = AssertSortItem[]

export function encodeSortList(sort: SortList): string {
    return sort.map(s => `${s.key } ${s.order}`).join(',');
}

export class SortListDecoder {
    static decode(data: Data): SortList {
        const str = data.string;
        const splitted = str.split(',');
        const list: SortList = []

        for (const [index, part] of splitted.entries()) {
            const sub = part.trim().split(' ');
            if (sub.length > 2 || sub.length === 0) {
                throw new SimpleError({
                    code: "invalid_field",
                    message: `Invalid sort list at ${data.currentField}`,
                    field: data.currentField
                });
            }

            const direction = sub.length === 1 ? SortItemDirection.ASC : data.clone({ 
                data: sub[1], 
                context: data.context, 
                field: data.addToCurrentField(index) 
            }).enum(SortItemDirection)

            const key = sub[0].trim();
            list.push({
                key,
                order: direction
            })
        }

        return list;
    }
}
