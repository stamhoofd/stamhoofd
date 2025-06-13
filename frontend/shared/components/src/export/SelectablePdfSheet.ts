import { SelectablePdfDataFilter, SelectablePdfSheetFilter } from '@stamhoofd/structures';
import { SelectablePdfData } from './SelectablePdfData';

export class SelectablePdfSheet<T> {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly items: SelectablePdfData<T>[] = [];

    constructor(data: {
        id: string;
        name: string;
        description?: string;
        items: SelectablePdfData<T>[];
        columnCount?: number;
    }) {
        Object.assign(this, data);
    }

    from(filter: SelectablePdfSheetFilter): void {
        this.disableAll();

        for (const { id } of filter.items) {
            const item = this.items.find(i => i.id === id);
            if (item) {
                item.enabled = true;
            }
        }
    }

    getFilter(): SelectablePdfSheetFilter {
        return SelectablePdfSheetFilter.create({
            id: this.id,
            items: this.items.filter(c => c.enabled).map(c => (SelectablePdfDataFilter.create({
                id: c.id,
            }))),
        });
    }

    disableAll(): void {
        this.items.forEach(item => item.enabled = false);
    }

    get enabled() {
        return this.items.some(c => c.enabled);
    }

    get enabledCount() {
        return this.items.filter(c => c.enabled).length;
    }
}
