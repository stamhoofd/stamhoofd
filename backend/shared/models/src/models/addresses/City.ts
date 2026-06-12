import { column } from '@simonbackx/simple-database';
import type { ManyToOneRelation } from '@simonbackx/simple-database';
import type { Country } from '@stamhoofd/types/Country';
import { v4 as uuidv4 } from 'uuid';

import { QueryableModel } from '@stamhoofd/sql';
import type { Province } from './Province.js';

export class City extends QueryableModel {
    static table = 'cities';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    name: string;

    @column({ type: 'string' })
    provinceId: string;

    @column({ type: 'string', nullable: true })
    parentCityId: string | null = null;

    @column({ type: 'string' })
    country: Country;

    // Relations are wired up in _relations.ts (after the classes are defined) to avoid circular references.
    static parentCity: ManyToOneRelation<'parentCity', City>;
    static province: ManyToOneRelation<'province', Province>;
}
