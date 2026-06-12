import { column } from '@simonbackx/simple-database';
import type { ManyToOneRelation } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { v4 as uuidv4 } from 'uuid';

import type { City } from './City.js';

export class Street extends QueryableModel {
    static table = 'streets';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    name: string;

    @column({ type: 'string' })
    cityId: string;

    // Relation is wired up in _relations.ts (after the classes are defined) to avoid circular references.
    static city: ManyToOneRelation<'city', City>;
}
