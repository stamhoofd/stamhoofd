import type { Model } from '@simonbackx/simple-database';

export interface InvoiceRelation extends Model {
    id: string;
    number: string | null;
}
