import { PdfDocumentFilter, PdfItemFilter } from '@stamhoofd/structures';
import { SelectablePdfData } from './SelectablePdfData';

export class SelectablePdfSheet<T> {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly items: SelectablePdfData<T>[] = [];
    private withCategoryRow: boolean = true;

    constructor(data: {
        id: string;
        name: string;
        description?: string;
        items: SelectablePdfData<T>[];
        columnCount?: number;
    }) {
        Object.assign(this, data);

        if (!this.items.find(c => c.category)) {
            this.withCategoryRow = false;
        }
    }

    from(filter: PdfDocumentFilter): void {
        this.disableAll();
        this.withCategoryRow = false;

        for (const { id, category } of filter.items) {
            const item = this.items.find(i => i.id === id);
            if (item) {
                item.enabled = true;
            }

            if (category !== undefined && category !== null) {
                this.withCategoryRow = true;
            }
        }
    }

    getFilter(): PdfDocumentFilter {
        return PdfDocumentFilter.create({
            id: this.id,
            name: this.name,
            items: this.items.filter(c => c.enabled).map(c => (PdfItemFilter.create({
                id: c.id,
                name: c.name,
                category: this.withCategoryRow ? (c.category ?? '') : null,
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
