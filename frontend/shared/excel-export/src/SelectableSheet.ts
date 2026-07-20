import type { SelectableColumn } from './SelectableColumn';

export class SelectableSheet {
    id: string;

    name: string;
    description: string;

    /**
     * Shown as a warning above the columns, for things the user has to know before exporting.
     */
    warning?: string;

    columns: SelectableColumn[];
    withCategoryRow: boolean = true;

    constructor(data: {
        id: string;
        name: string;
        description?: string;
        warning?: string;
        columns: SelectableColumn[];
    }) {
        Object.assign(this, data);

        if (!this.columns.find(c => c.category)) {
            this.withCategoryRow = false;
        }
    }

    disableAll() {
        for (const column of this.columns) {
            column.enabled = false;
        }
    }

    get enabled() {
        return this.columns.some(c => c.enabled);
    }

    get enabledCount() {
        return this.columns.filter(c => c.enabled).length;
    }
}
