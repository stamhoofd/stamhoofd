export class SelectableColumn {
    enabled: boolean;
    id: string;

    name: string;
    description: string;
    category?: string

    constructor(data: {
        enabled?: boolean;
        id: string;
        name: string;
        description?: string;
        category?: string;
    }) {
        Object.assign(this, data);
    }
}
