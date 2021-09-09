import { Migration } from '@simonbackx/simple-database';
import { column,Model } from '@simonbackx/simple-database';
import { StringCompare } from '@stamhoofd/utility';
import { v4 as uuidv4 } from "uuid";
import { Country } from "@stamhoofd/structures";
import { City } from '../models/addresses/City';
import { PostalCode } from '../models/addresses/PostalCode';
import { Province } from '../models/addresses/Province';


export class Gemeente extends Model {
    static table = "gemeenten"

    @column({
        primary: true, type: "string", beforeSave(value) {
            return value ?? uuidv4();
        }
    })
    id!: string;

    @column({ type: "string" })
    postcode: string;

    @column({ type: "string" })
    gemeente: string;

    @column({ type: "string" })
    postcode_hoofdgemeente: string; // not relevant anymore

    @column({ type: "string" })
    hoofdgemeente: string;

    @column({ type: "string" })
    provincie: string;

    /// Tmp mapped
    city!: City;
}

async function getProvince(name: string, provinces: Province[]): Promise<Province> {
    const p = provinces.find(p => StringCompare.typoCount(p.name, name) < 2 && p.country == Country.Belgium)
    if (p) {
        return p
    }
    const province = new Province()
    province.country = Country.Belgium
    province.name = name.trim()
    await province.save()
    provinces.push(province)
    return province
}

export default new Migration(async () => {
    if (process.env.NODE_ENV == "test") {
        console.log("skipped in tests")
        return;
    }
    // Loop all gemeenten
    const provinces = await Province.all();
    const gemeenten = await Gemeente.all();
    const cities: City[] = []

    for (const gemeente of gemeenten) {
        const province = await getProvince(gemeente.provincie, provinces)
        
        // Some cities have the same name
        const found = cities.find(c => c.name.trim() == gemeente.gemeente.trim() && c.provinceId == province.id)

        if (!found) {
            // Create the city
            const city = new City()
            city.name = gemeente.gemeente.trim()
            city.country = Country.Belgium
            city.provinceId = province.id

            await city.save()

            // Also add postal code already
            const postalCode = new PostalCode()
            postalCode.postalCode = gemeente.postcode
            postalCode.cityId = city.id
            postalCode.country = Country.Belgium
            await postalCode.save();

            gemeente.city = city
            cities.push(city)
        } else {
            gemeente.city = found;

             // Also add postal code already
            const postalCode = new PostalCode()
            postalCode.postalCode = gemeente.postcode
            postalCode.cityId = found.id
            postalCode.country = Country.Belgium
            await postalCode.save();
        }
        
    }

    for (const gemeente of gemeenten) {
        if (gemeente.gemeente.trim() == gemeente.hoofdgemeente.trim()) {
            continue;
        }

        const hoofd = cities.find(c => c.name.trim() == gemeente.hoofdgemeente.trim() && c.provinceId == gemeente.city.provinceId)
        if (!hoofd) {
            // Create the city
            const city = new City()
            city.name = gemeente.hoofdgemeente.trim()
            city.country = Country.Belgium

            const province = await getProvince(gemeente.provincie, provinces)
            city.provinceId = province.id
            await city.save()

            cities.push(city)
            // do not create a postal code here, these don't have one

            console.log("Assigning "+gemeente.gemeente+" to "+city.name)
            gemeente.city.parentCityId = city.id
            await gemeente.city.save()
        } else {
            console.log("Assigning "+gemeente.gemeente+" to "+hoofd.name)
            gemeente.city.parentCityId = hoofd.id
            await gemeente.city.save()
        }

        
    }
});


