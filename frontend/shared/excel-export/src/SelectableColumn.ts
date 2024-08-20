export class SelectableColumn {
    enabled: boolean = true
    id: string;

    name: string;
    description: string = ''
    category?: string|null = null

    constructor(data: {
        enabled?: boolean;
        id: string;
        name: string;
        description?: string;
        category?: string|null;
    }) {
        Object.assign(this, data);
    }
}
