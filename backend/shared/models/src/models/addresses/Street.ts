import { column, ManyToOneRelation, Model } from '@simonbackx/simple-database';
import { v4 as uuidv4 } from "uuid";

import { City } from './City';

export class Street extends Model {
    static table = "streets"

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;
    
    @column({ type: "string" })
    name: string;
    
    @column({ type: "string", foreignKey: Street.city })
    cityId: string;

    static city = new ManyToOneRelation(City, "city")

    
}