import { SelectableColumn } from "./SelectableColumn";

export class SelectableSheet {
    id: string;

    name: string;
    description: string;
    columns: SelectableColumn[];

    constructor(data: {
        id: string;
        name: string;
        description?: string;
        columns: SelectableColumn[];
    }) {
        Object.assign(this, data);
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

