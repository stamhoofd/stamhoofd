import { PdfDocumentFilter, PdfDocumentsFilter, PdfItemFilter } from '@stamhoofd/structures';
import { SelectablePdfColumn } from './SelectablePdfColumn';

export type PdfItemSorter<T> = (a: T, b: T) => 0 | 1 | -1;

export class PdfDocument<T> {
    readonly id: string;
    readonly name: string;
    readonly description: string;
    readonly items: SelectablePdfColumn<T>[] = [];
    private withCategoryRow: boolean = true;
    readonly getItemName: (item: T) => string;
    readonly columnCount = 1;
    readonly sorter?: PdfItemSorter<T>;

    constructor(data: {
        id: string;
        name: string;
        description?: string;
        items: SelectablePdfColumn<T>[];
        getItemName: (item: T) => string;
        columnCount?: number;
        sorter?: PdfItemSorter<T>;
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

export class PdfDocuments<T> {
    readonly documents: PdfDocument<T>[] = [];

    get size() {
        return this.documents.length;
    }

    constructor(data: { documents: PdfDocument<T>[] }) {
        this.documents = data.documents;
    }

    disableAll(): void {
        this.documents.forEach(d => d.disableAll());
    }

    from(filter: PdfDocumentsFilter): void {
        this.disableAll();

        for (const documentFilter of filter.documents) {
            const document = this.documents.find(document => document.id === documentFilter.id);
            if (!document) {
                continue;
            }

            document.from(documentFilter);
        }
    }

    getFilter(): PdfDocumentsFilter {
        return PdfDocumentsFilter.create({
            documents: this.documents.flatMap((document) => {
                if (!document.enabled) {
                    return [];
                }

                return [document.getFilter()];
            }),
        });
    }
}
