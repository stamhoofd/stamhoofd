import { Model } from '../../database/classes/Model';
import { column } from '../../database/decorators/Column';

export class Address extends Model {
    static table = "addresses"

    @column({ primary: true })
    id: number | null = null;

    @column()
    street = "";

    @column()
    number = "";

    @column()
    postalCode = "";

    @column()
    city = "";

    @column()
    country = "BE";
}
