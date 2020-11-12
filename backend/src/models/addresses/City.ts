import { column,ManyToOneRelation,Model } from '@simonbackx/simple-database';
import { Country } from '@stamhoofd/structures';
import { v4 as uuidv4 } from "uuid";

import { Province } from './Province';

export class City extends Model {
    static table = "cities"

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    name: string;

    @column({ type: "string", foreignKey: City.province })
    provinceId: string;

    @column({ type: "string", foreignKey: City.parentCity, nullable: true })
    parentCityId: string | null = null;

    @column({ type: "string" })
    country: Country;

    static parentCity = new ManyToOneRelation(City, "parentCity")
    static province = new ManyToOneRelation(Province, "province")
}