import { column } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { Country } from '@stamhoofd/structures';
import { v4 as uuidv4 } from 'uuid';

export class Province extends QueryableModel {
    static table = 'provinces';

    @column({
        primary: true, type: 'string', beforeSave(value) {
            return value ?? uuidv4();
        },
    })
    id!: string;

    @column({ type: 'string' })
    name: string;

    @column({ type: 'string' })
    country: Country;
}
