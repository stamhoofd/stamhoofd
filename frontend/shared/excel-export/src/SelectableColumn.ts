import { SelectableData } from '@stamhoofd/components';

export class SelectableColumn implements SelectableData {
    enabled: boolean = true;
    id: string;

    name: string;
    description: string = '';
    category?: string | null = null;

    constructor(data: {
        enabled?: boolean;
        id: string;
        name: string;
        description?: string;
        category?: string | null;
    }) {
        Object.assign(this, data);
    }
}
