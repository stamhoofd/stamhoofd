import { column, Database, Migration } from '@simonbackx/simple-database';
import { QueryableModel } from '@stamhoofd/sql';
import { Country } from '@stamhoofd/types/Country';
import { StringCompare } from '@stamhoofd/utility';
import { v4 as uuidv4 } from 'uuid';
import { City } from '../models/addresses/City.js';
import { PostalCode } from '../models/addresses/PostalCode.js';
import { Province } from '../models/addresses/Province.js';

export class Gemeente extends QueryableModel {
    static table = 'gemeenten';

    @column({
        primary: true, type: 'integer',
    })
    id!: number;

    @column({ type: 'string' })
    postcode: string;

    @column({ type: 'string' })
    gemeente: string;

    @column({ type: 'string' })
    postcode_hoofdgemeente: string; // not relevant anymore

    @column({ type: 'string' })
    hoofdgemeente: string;

    @column({ type: 'string' })
    provincie: string;

    /// Tmp mapped
    city!: City;
}

function getProvince(name: string, provinces: Province[], provinceRows: string[][]): Province {
    const p = provinces.find(p => StringCompare.typoCount(p.name, name) < 2 && p.country == Country.Belgium);
    if (p) {
        return p;
    }
    const province = new Province();
    province.id = uuidv4();
    province.country = Country.Belgium;
    province.name = name.trim();
    provinces.push(province);
    provinceRows.push([province.id, province.name, province.country]);
    return province;
}

export default new Migration(async () => {
    if (STAMHOOFD.environment == 'test') {
        console.log('skipped in tests');
        return;
    }
    // Loop all gemeenten
    const provinces = await Province.all();
    const gemeenten = await Gemeente.all();
    const citiesByNameAndProvince = new Map<string, City>();
    const provinceRows: string[][] = [];
    const cityRows: unknown[][] = [];
    const postalCodeRows: string[][] = [];
    const parentCityUpdates = new Map<string, string>();

    for (const gemeente of gemeenten) {
        const province = getProvince(gemeente.provincie, provinces, provinceRows);

        // Some cities have the same name
        const found = citiesByNameAndProvince.get(cityKey(gemeente.gemeente, province.id));

        if (!found) {
            // Create the city
            const city = new City();
            city.id = uuidv4();
            city.name = gemeente.gemeente.trim();
            city.country = Country.Belgium;
            city.provinceId = province.id;
            cityRows.push([city.id, city.name, city.provinceId, city.parentCityId, city.country]);

            // Also add postal code already
            postalCodeRows.push([uuidv4(), gemeente.postcode, city.id, Country.Belgium]);

            gemeente.city = city;
            citiesByNameAndProvince.set(cityKey(city.name, city.provinceId), city);
        }
        else {
            gemeente.city = found;

            // Also add postal code already
            postalCodeRows.push([uuidv4(), gemeente.postcode, found.id, Country.Belgium]);
        }
    }

    for (const gemeente of gemeenten) {
        if (gemeente.gemeente.trim() == gemeente.hoofdgemeente.trim()) {
            continue;
        }

        const hoofd = citiesByNameAndProvince.get(cityKey(gemeente.hoofdgemeente, gemeente.city.provinceId));
        if (!hoofd) {
            // Create the city
            const city = new City();
            city.id = uuidv4();
            city.name = gemeente.hoofdgemeente.trim();
            city.country = Country.Belgium;

            const province = getProvince(gemeente.provincie, provinces, provinceRows);
            city.provinceId = province.id;
            cityRows.push([city.id, city.name, city.provinceId, city.parentCityId, city.country]);

            citiesByNameAndProvince.set(cityKey(city.name, city.provinceId), city);
            // do not create a postal code here, these don't have one

            // console.log('Assigning ' + gemeente.gemeente + ' to ' + city.name);
            gemeente.city.parentCityId = city.id;
            parentCityUpdates.set(gemeente.city.id, city.id);
        }
        else {
            // console.log('Assigning ' + gemeente.gemeente + ' to ' + hoofd.name);
            gemeente.city.parentCityId = hoofd.id;
            parentCityUpdates.set(gemeente.city.id, hoofd.id);
        }
    }

    await insertRows(Province.table, ['id', 'name', 'country'], provinceRows);
    await insertRows(City.table, ['id', 'name', 'provinceId', 'parentCityId', 'country'], cityRows);
    await insertRows(PostalCode.table, ['id', 'postalCode', 'cityId', 'country'], postalCodeRows);
    await updateParentCityIds([...parentCityUpdates.entries()]);
});
function cityKey(name: string, provinceId: string): string {
    return `${name.trim()}\0${provinceId}`;
}

async function insertRows(table: string, columns: string[], rows: unknown[][]): Promise<void> {
    for (const chunk of chunks(rows, 1000)) {
        if (chunk.length === 0) {
            continue;
        }
        await Database.insert(`INSERT INTO \`${table}\` (${columns.map(column => `\`${column}\``).join(', ')}) VALUES ?`, [chunk]);
    }
}

async function updateParentCityIds(rows: string[][]): Promise<void> {
    for (const chunk of chunks(rows, 1000)) {
        if (chunk.length === 0) {
            continue;
        }
        const cases = chunk.map(() => 'WHEN ? THEN ?').join(' ');
        await Database.statement(`UPDATE \`${City.table}\` SET \`parentCityId\` = CASE \`id\` ${cases} END WHERE \`id\` IN (?)`, [
            ...chunk.flatMap(([cityId, parentCityId]) => [cityId, parentCityId]),
            chunk.map(([cityId]) => cityId),
        ]);
    }
}

function chunks<T>(values: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let index = 0; index < values.length; index += size) {
        result.push(values.slice(index, index + size));
    }
    return result;
}
